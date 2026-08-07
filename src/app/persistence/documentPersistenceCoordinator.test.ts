// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { COMMAND_TEST_IDS } from "../../domain/commands/commandTestSupport";
import type { SaveDocumentRequest } from "../../platform/database/databaseTypes";
import { DEFAULT_DOCUMENT_AUTOSAVE_DELAY_MS } from "./persistenceScheduler";
import {
  createDeferred,
  createWorkspaceTestStore,
  FakePersistenceScheduler,
  loadTestWorkspace,
  renameCommand,
  savedDocument,
  settlePersistenceContinuations,
} from "../workspace/workspaceTestSupport";

describe("document persistence debounce", () => {
  it("re-arms the 350 ms trailing edge and encodes only the latest document", async () => {
    const scheduler = new FakePersistenceScheduler();
    const encodeDocument = vi.fn((document) => ({
      ok: true as const,
      value: JSON.stringify(document),
    }));
    const saveDocument = vi.fn(async (_request: SaveDocumentRequest) => savedDocument(5));
    const store = createWorkspaceTestStore({
      databaseClient: { saveDocument },
      scheduler,
      encodeDocument,
    });
    loadTestWorkspace(store);

    store.workspace.dispatchCommand(renameCommand("First change"));
    store.workspace.dispatchCommand(renameCommand("Second change"));
    store.workspace.dispatchCommand(renameCommand("Latest change"));

    expect(DEFAULT_DOCUMENT_AUTOSAVE_DELAY_MS).toBe(350);
    expect(scheduler.delays).toEqual([350, 350, 350]);
    expect(scheduler.cancel).toHaveBeenNthCalledWith(1, scheduler.handles[0]);
    expect(scheduler.cancel).toHaveBeenNthCalledWith(2, scheduler.handles[1]);
    expect(scheduler.size).toBe(1);
    expect(encodeDocument).not.toHaveBeenCalled();
    expect(saveDocument).not.toHaveBeenCalled();

    scheduler.runRegistered(scheduler.handles[0]);
    scheduler.runRegistered(scheduler.handles[1]);
    await Promise.resolve();
    expect(encodeDocument).not.toHaveBeenCalled();
    expect(saveDocument).not.toHaveBeenCalled();
    expect(scheduler.size).toBe(1);

    scheduler.runNext();
    await Promise.resolve();

    expect(encodeDocument).toHaveBeenCalledTimes(1);
    expect(saveDocument).toHaveBeenCalledTimes(1);
    expect(JSON.parse(saveDocument.mock.calls[0][0].serializedDocument)).toMatchObject({
      canvases: { [COMMAND_TEST_IDS.canvasA]: { name: "Latest change" } },
    });
  });

  it("cancels the only timer and supports an explicit flush", async () => {
    const scheduler = new FakePersistenceScheduler();
    const saveDocument = vi.fn(async () => savedDocument(5));
    const store = createWorkspaceTestStore({ databaseClient: { saveDocument }, scheduler });
    loadTestWorkspace(store);
    store.workspace.dispatchCommand(renameCommand("Changed"));

    store.workspace.cancelScheduledPersistence();
    expect(scheduler.size).toBe(0);
    expect(store.getState().documentWorkspace.savePhase).toBe("dirty");
    expect(saveDocument).not.toHaveBeenCalled();

    await store.workspace.flushSave();
    expect(saveDocument).toHaveBeenCalledTimes(1);
    expect(store.getState().documentWorkspace.savePhase).toBe("clean");
  });

  it("leaves a healthy scheduled autosave untouched when retry is requested", async () => {
    const scheduler = new FakePersistenceScheduler();
    const saveDocument = vi.fn(async () => savedDocument(5));
    const store = createWorkspaceTestStore({ databaseClient: { saveDocument }, scheduler });
    loadTestWorkspace(store, 4);
    store.workspace.dispatchCommand(renameCommand("Scheduled change"));
    const scheduledHandle = scheduler.handles[0];

    await store.workspace.retrySave();

    expect(scheduler.handles).toEqual([scheduledHandle]);
    expect(scheduler.cancel).not.toHaveBeenCalled();
    expect(scheduler.size).toBe(1);
    expect(saveDocument).not.toHaveBeenCalled();

    scheduler.runNext();
    await settlePersistenceContinuations();

    expect(saveDocument).toHaveBeenCalledTimes(1);
    expect(store.getState().documentWorkspace.savePhase).toBe("clean");
  });

  it("treats retry on a clean workspace as a no-op", async () => {
    const scheduler = new FakePersistenceScheduler();
    const saveDocument = vi.fn();
    const store = createWorkspaceTestStore({ databaseClient: { saveDocument }, scheduler });
    loadTestWorkspace(store, 4);
    const cleanState = store.getState().documentWorkspace;

    await store.workspace.retrySave();

    expect(store.getState().documentWorkspace).toBe(cleanState);
    expect(scheduler.cancel).not.toHaveBeenCalled();
    expect(scheduler.size).toBe(0);
    expect(saveDocument).not.toHaveBeenCalled();
  });
});

describe("revision-aware document saves", () => {
  it("acknowledges a normal save against the loaded revision", async () => {
    const scheduler = new FakePersistenceScheduler();
    const saveDocument = vi.fn(async () => savedDocument(5));
    const store = createWorkspaceTestStore({ databaseClient: { saveDocument }, scheduler });
    loadTestWorkspace(store, 4);
    store.workspace.dispatchCommand(renameCommand("Changed"));

    scheduler.runNext();
    await Promise.resolve();
    await Promise.resolve();

    expect(saveDocument).toHaveBeenCalledWith(expect.objectContaining({ expectedRevision: 4 }));
    expect(store.getState().documentWorkspace).toMatchObject({
      backendRevision: 5,
      localChangeSequence: 1,
      persistedChangeSequence: 1,
      savePhase: "clean",
      saveInFlight: false,
    });
  });

  it("keeps a newer change dirty and follows up with the acknowledged revision", async () => {
    const scheduler = new FakePersistenceScheduler();
    const first = createDeferred<ReturnType<typeof savedDocument>>();
    const second = createDeferred<ReturnType<typeof savedDocument>>();
    const saveDocument = vi
      .fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    const store = createWorkspaceTestStore({ databaseClient: { saveDocument }, scheduler });
    loadTestWorkspace(store, 4);
    store.workspace.dispatchCommand(renameCommand("Sequence one"));
    scheduler.runNext();
    await Promise.resolve();
    expect(saveDocument).toHaveBeenCalledTimes(1);

    const secondCommand = store.workspace.dispatchCommand(renameCommand("Sequence two"));
    expect(secondCommand).toMatchObject({ ok: true, changed: true });
    expect(saveDocument).toHaveBeenCalledTimes(1);
    expect(scheduler.size).toBe(0);

    first.resolve(savedDocument(5));
    await first.promise;
    await settlePersistenceContinuations();
    expect(store.getState().documentWorkspace).toMatchObject({
      backendRevision: 5,
      localChangeSequence: 2,
      persistedChangeSequence: 1,
      savePhase: "scheduled",
    });
    expect(scheduler.size).toBe(1);

    scheduler.runNext();
    await Promise.resolve();
    expect(saveDocument).toHaveBeenCalledTimes(2);
    expect(saveDocument.mock.calls[1][0].expectedRevision).toBe(5);
    expect(JSON.parse(saveDocument.mock.calls[1][0].serializedDocument)).toMatchObject({
      canvases: { [COMMAND_TEST_IDS.canvasA]: { name: "Sequence two" } },
    });

    second.resolve(savedDocument(6));
    await second.promise;
    await settlePersistenceContinuations();
    expect(store.getState().documentWorkspace).toMatchObject({
      backendRevision: 6,
      localChangeSequence: 2,
      persistedChangeSequence: 2,
      savePhase: "clean",
    });
  });

  it("flushes every newer generation after successful in-flight saves", async () => {
    const scheduler = new FakePersistenceScheduler();
    const first = createDeferred<ReturnType<typeof savedDocument>>();
    const second = createDeferred<ReturnType<typeof savedDocument>>();
    const third = createDeferred<ReturnType<typeof savedDocument>>();
    const saveDocument = vi
      .fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise)
      .mockImplementationOnce(() => third.promise);
    const store = createWorkspaceTestStore({ databaseClient: { saveDocument }, scheduler });
    loadTestWorkspace(store, 4);
    store.workspace.dispatchCommand(renameCommand("Sequence one"));
    scheduler.runNext();
    await Promise.resolve();
    store.workspace.dispatchCommand(renameCommand("Sequence two"));

    let flushFinished = false;
    const flush = store.workspace.flushSave().then(() => {
      flushFinished = true;
    });
    first.resolve(savedDocument(5));
    await first.promise;
    await settlePersistenceContinuations();

    expect(flushFinished).toBe(false);
    expect(saveDocument).toHaveBeenCalledTimes(2);
    expect(saveDocument.mock.calls[1][0].expectedRevision).toBe(5);
    expect(scheduler.size).toBe(0);
    store.workspace.dispatchCommand(renameCommand("Sequence three"));

    second.resolve(savedDocument(6));
    await second.promise;
    await settlePersistenceContinuations();

    expect(flushFinished).toBe(false);
    expect(saveDocument).toHaveBeenCalledTimes(3);
    expect(saveDocument.mock.calls[2][0].expectedRevision).toBe(6);
    expect(JSON.parse(saveDocument.mock.calls[2][0].serializedDocument)).toMatchObject({
      canvases: { [COMMAND_TEST_IDS.canvasA]: { name: "Sequence three" } },
    });

    third.resolve(savedDocument(7));
    await flush;

    expect(store.getState().documentWorkspace).toMatchObject({
      backendRevision: 7,
      localChangeSequence: 3,
      persistedChangeSequence: 3,
      savePhase: "clean",
    });
    expect(saveDocument.mock.calls.map(([request]) => request.expectedRevision)).toEqual([4, 5, 6]);
  });

  it("never blocks synchronous commands on unresolved database work", async () => {
    const scheduler = new FakePersistenceScheduler();
    const pending = createDeferred<ReturnType<typeof savedDocument>>();
    const saveDocument = vi.fn(() => pending.promise);
    const store = createWorkspaceTestStore({ databaseClient: { saveDocument }, scheduler });
    loadTestWorkspace(store);
    store.workspace.dispatchCommand(renameCommand("Saving"));
    scheduler.runNext();
    await Promise.resolve();

    const result = store.workspace.dispatchCommand(renameCommand("Still interactive"));

    expect(result).toMatchObject({ ok: true, changed: true });
    expect(
      store.getState().documentWorkspace.document!.canvases[COMMAND_TEST_IDS.canvasA].name,
    ).toBe("Still interactive");
    expect(store.getState().documentWorkspace.localChangeSequence).toBe(2);
    expect(saveDocument).toHaveBeenCalledTimes(1);
  });
});
