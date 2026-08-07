// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { PlatformErrorCode } from "../../platform/platformErrors";
import {
  createDeferred,
  createWorkspaceTestStore,
  FakePersistenceScheduler,
  loadTestWorkspace,
  renameCommand,
  savedDocument,
  settlePersistenceContinuations,
} from "../workspace/workspaceTestSupport";

function failedSave(code: PlatformErrorCode, retryable = true) {
  return {
    ok: false as const,
    error: { code, message: "unsafe document payload and backend detail", retryable },
  };
}

describe("document persistence failures", () => {
  it("keeps the workspace dirty and skips the database when encoding fails", async () => {
    const scheduler = new FakePersistenceScheduler();
    const saveDocument = vi.fn();
    const store = createWorkspaceTestStore({
      databaseClient: { saveDocument },
      scheduler,
      encodeDocument: () => failedSave("invalid_document_payload", false),
    });
    loadTestWorkspace(store);
    store.workspace.dispatchCommand(renameCommand("private command payload"));

    scheduler.runNext();
    await Promise.resolve();
    await Promise.resolve();

    expect(saveDocument).not.toHaveBeenCalled();
    expect(store.getState().documentWorkspace).toMatchObject({
      localChangeSequence: 1,
      persistedChangeSequence: 0,
      savePhase: "failed",
      persistenceError: { code: "invalid_document_payload" },
    });
    expect(JSON.stringify(store.getState().documentWorkspace.persistenceError)).not.toContain(
      "private command payload",
    );
  });

  it("supports an explicit non-conflict retry with the latest revision", async () => {
    const scheduler = new FakePersistenceScheduler();
    const saveDocument = vi
      .fn()
      .mockResolvedValueOnce(failedSave("save_failure"))
      .mockResolvedValueOnce(savedDocument(5));
    const store = createWorkspaceTestStore({ databaseClient: { saveDocument }, scheduler });
    loadTestWorkspace(store, 4);
    store.workspace.dispatchCommand(renameCommand("Changed"));
    scheduler.runNext();
    await Promise.resolve();
    await Promise.resolve();
    expect(store.getState().documentWorkspace.savePhase).toBe("failed");
    expect(store.getState().documentWorkspace.persistedChangeSequence).toBe(0);

    await store.workspace.retrySave();

    expect(saveDocument).toHaveBeenCalledTimes(2);
    expect(saveDocument.mock.calls[1][0].expectedRevision).toBe(4);
    expect(store.getState().documentWorkspace).toMatchObject({
      backendRevision: 5,
      persistedChangeSequence: 1,
      savePhase: "clean",
      persistenceError: null,
    });
    expect(JSON.stringify(store.getState().documentWorkspace)).not.toContain("unsafe document");
  });

  it("continues flushing newer generations after a successful retry", async () => {
    const scheduler = new FakePersistenceScheduler();
    const retryAttempt = createDeferred<ReturnType<typeof savedDocument>>();
    const followUp = createDeferred<ReturnType<typeof savedDocument>>();
    const saveDocument = vi
      .fn()
      .mockResolvedValueOnce(failedSave("save_failure"))
      .mockImplementationOnce(() => retryAttempt.promise)
      .mockImplementationOnce(() => followUp.promise);
    const store = createWorkspaceTestStore({ databaseClient: { saveDocument }, scheduler });
    loadTestWorkspace(store, 4);
    store.workspace.dispatchCommand(renameCommand("Failed generation"));
    scheduler.runNext();
    await Promise.resolve();
    await Promise.resolve();

    const retry = store.workspace.retrySave();
    await Promise.resolve();
    store.workspace.dispatchCommand(renameCommand("Newer generation"));
    retryAttempt.resolve(savedDocument(5));
    await retryAttempt.promise;
    await settlePersistenceContinuations();

    expect(saveDocument).toHaveBeenCalledTimes(3);
    expect(saveDocument.mock.calls[2][0].expectedRevision).toBe(5);
    followUp.resolve(savedDocument(6));
    await retry;

    expect(store.getState().documentWorkspace).toMatchObject({
      backendRevision: 6,
      localChangeSequence: 2,
      persistedChangeSequence: 2,
      savePhase: "clean",
    });
  });

  it("stops flush after failure and requires one explicit retry per failed attempt", async () => {
    const scheduler = new FakePersistenceScheduler();
    const first = createDeferred<ReturnType<typeof failedSave>>();
    const saveDocument = vi
      .fn()
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValueOnce(failedSave("session_locked"));
    const store = createWorkspaceTestStore({ databaseClient: { saveDocument }, scheduler });
    loadTestWorkspace(store, 4);
    store.workspace.dispatchCommand(renameCommand("Sequence one"));
    scheduler.runNext();
    await Promise.resolve();
    store.workspace.dispatchCommand(renameCommand("Sequence two"));

    const flush = store.workspace.flushSave();
    first.resolve(failedSave("save_failure"));
    await flush;

    expect(saveDocument).toHaveBeenCalledTimes(1);
    expect(scheduler.size).toBe(0);
    expect(store.getState().documentWorkspace).toMatchObject({
      localChangeSequence: 2,
      persistedChangeSequence: 0,
      savePhase: "failed",
    });

    await store.workspace.flushSave();
    expect(saveDocument).toHaveBeenCalledTimes(1);

    await store.workspace.retrySave();

    expect(saveDocument).toHaveBeenCalledTimes(2);
    expect(saveDocument.mock.calls.map(([request]) => request.expectedRevision)).toEqual([4, 4]);
    expect(store.getState().documentWorkspace.savePhase).toBe("failed");
    await Promise.resolve();
    expect(saveDocument).toHaveBeenCalledTimes(2);
  });

  it("allows a later mutation to schedule after a retryable failure", async () => {
    const scheduler = new FakePersistenceScheduler();
    const saveDocument = vi.fn(async () => failedSave("session_locked"));
    const store = createWorkspaceTestStore({ databaseClient: { saveDocument }, scheduler });
    loadTestWorkspace(store);
    store.workspace.dispatchCommand(renameCommand("First"));
    scheduler.runNext();
    await Promise.resolve();
    await Promise.resolve();
    expect(scheduler.size).toBe(0);

    store.workspace.dispatchCommand(renameCommand("Later"));

    expect(scheduler.size).toBe(1);
    expect(store.getState().documentWorkspace.savePhase).toBe("scheduled");
  });

  it("blocks automatic saves, flush, and retry after a revision conflict", async () => {
    const scheduler = new FakePersistenceScheduler();
    const saveDocument = vi.fn(async () => failedSave("revision_conflict", false));
    const store = createWorkspaceTestStore({ databaseClient: { saveDocument }, scheduler });
    loadTestWorkspace(store, 4);
    store.workspace.dispatchCommand(renameCommand("Local edits must survive"));
    scheduler.runNext();
    await Promise.resolve();
    await Promise.resolve();

    expect(store.getState().documentWorkspace).toMatchObject({
      savePhase: "conflict",
      revisionConflict: { expectedRevision: 4 },
      localChangeSequence: 1,
      persistedChangeSequence: 0,
    });
    const document = store.getState().documentWorkspace.document;
    const history = store.getState().documentWorkspace.history;
    const conflictState = store.getState().documentWorkspace;

    await store.workspace.retrySave();

    expect(store.getState().documentWorkspace).toBe(conflictState);
    expect(saveDocument).toHaveBeenCalledTimes(1);
    expect(scheduler.cancel).not.toHaveBeenCalled();
    await store.workspace.flushSave();
    store.workspace.dispatchCommand(renameCommand("More local edits"));

    expect(saveDocument).toHaveBeenCalledTimes(1);
    expect(scheduler.size).toBe(0);
    expect(store.getState().documentWorkspace.document).not.toBe(document);
    expect(store.getState().documentWorkspace.history.past.length).toBe(history.past.length + 1);
    expect(store.getState().documentWorkspace.savePhase).toBe("conflict");
    expect(store.getState().documentWorkspace.localChangeSequence).toBe(2);
  });
});

describe("workspace epoch and coordinator disposal", () => {
  it.each([
    ["success", savedDocument(5)],
    ["failure", failedSave("save_failure")],
  ] as const)("ignores an old workspace %s completion", async (_label, completion) => {
    const scheduler = new FakePersistenceScheduler();
    const pending = createDeferred<typeof completion>();
    const saveDocument = vi.fn(() => pending.promise);
    const store = createWorkspaceTestStore({ databaseClient: { saveDocument }, scheduler });
    loadTestWorkspace(store, 4);
    store.workspace.dispatchCommand(renameCommand("Workspace A"));
    scheduler.runNext();
    await Promise.resolve();
    const loaded = loadTestWorkspace(store, 8);
    expect(loaded.epoch).toBe(2);
    const beforeCompletion = store.getState().documentWorkspace;

    pending.resolve(completion);
    await pending.promise;
    await Promise.resolve();
    await Promise.resolve();

    expect(store.getState().documentWorkspace).toBe(beforeCompletion);
  });

  it.each(["flushSave", "retrySave"] as const)(
    "%s started in workspace A cannot continue into replacement workspace B",
    async (operation) => {
      const scheduler = new FakePersistenceScheduler();
      const first = createDeferred<ReturnType<typeof savedDocument>>();
      const saveDocument = vi
        .fn()
        .mockImplementationOnce(() => first.promise)
        .mockResolvedValueOnce(savedDocument(9));
      const store = createWorkspaceTestStore({ databaseClient: { saveDocument }, scheduler });
      loadTestWorkspace(store, 4);
      store.workspace.dispatchCommand(renameCommand("Workspace A"));
      scheduler.runNext();
      await Promise.resolve();

      const continuation = store.workspace[operation]();
      loadTestWorkspace(store, 8);
      store.workspace.dispatchCommand(renameCommand("Workspace B"));
      expect(scheduler.size).toBe(1);

      first.resolve(savedDocument(5));
      await continuation;

      expect(saveDocument).toHaveBeenCalledTimes(1);
      expect(scheduler.size).toBe(1);
      scheduler.runNext();
      await Promise.resolve();
      await Promise.resolve();
      expect(saveDocument).toHaveBeenCalledTimes(2);
      expect(saveDocument.mock.calls[1][0].expectedRevision).toBe(8);
    },
  );

  it.each(["flushSave", "retrySave"] as const)(
    "clear prevents an awaited %s continuation without disabling a later workspace",
    async (operation) => {
      const scheduler = new FakePersistenceScheduler();
      const first = createDeferred<ReturnType<typeof savedDocument>>();
      const saveDocument = vi
        .fn()
        .mockImplementationOnce(() => first.promise)
        .mockResolvedValueOnce(savedDocument(9));
      const store = createWorkspaceTestStore({ databaseClient: { saveDocument }, scheduler });
      loadTestWorkspace(store, 4);
      store.workspace.dispatchCommand(renameCommand("Workspace A"));
      scheduler.runNext();
      await Promise.resolve();

      const continuation = store.workspace[operation]();
      store.workspace.clear();
      first.resolve(savedDocument(5));
      await continuation;

      expect(saveDocument).toHaveBeenCalledTimes(1);
      expect(store.getState().documentWorkspace.document).toBeNull();
      loadTestWorkspace(store, 8);
      store.workspace.dispatchCommand(renameCommand("Workspace B"));
      expect(scheduler.size).toBe(1);
      scheduler.runNext();
      await Promise.resolve();
      await Promise.resolve();
      expect(saveDocument).toHaveBeenCalledTimes(2);
      expect(saveDocument.mock.calls[1][0].expectedRevision).toBe(8);
    },
  );

  it("ignores completion after clear", async () => {
    const scheduler = new FakePersistenceScheduler();
    const pending = createDeferred<ReturnType<typeof savedDocument>>();
    const store = createWorkspaceTestStore({
      databaseClient: { saveDocument: vi.fn(() => pending.promise) },
      scheduler,
    });
    loadTestWorkspace(store);
    store.workspace.dispatchCommand(renameCommand("Saving"));
    scheduler.runNext();
    await Promise.resolve();
    store.workspace.clear();
    const cleared = store.getState().documentWorkspace;

    pending.resolve(savedDocument(5));
    await pending.promise;
    await Promise.resolve();

    expect(store.getState().documentWorkspace).toBe(cleared);
  });

  it("disposal cancels timers and prevents in-flight callbacks from dispatching", async () => {
    const scheduler = new FakePersistenceScheduler();
    const pending = createDeferred<ReturnType<typeof savedDocument>>();
    const store = createWorkspaceTestStore({
      databaseClient: { saveDocument: vi.fn(() => pending.promise) },
      scheduler,
    });
    loadTestWorkspace(store);
    store.workspace.dispatchCommand(renameCommand("Scheduled"));
    store.disposeWorkspace();
    expect(scheduler.size).toBe(0);

    const inFlightScheduler = new FakePersistenceScheduler();
    const secondStore = createWorkspaceTestStore({
      databaseClient: { saveDocument: vi.fn(() => pending.promise) },
      scheduler: inFlightScheduler,
    });
    loadTestWorkspace(secondStore);
    secondStore.workspace.dispatchCommand(renameCommand("Saving"));
    inFlightScheduler.runNext();
    await Promise.resolve();
    secondStore.disposeWorkspace();
    const beforeCompletion = secondStore.getState().documentWorkspace;

    pending.resolve(savedDocument(5));
    await pending.promise;
    await Promise.resolve();

    expect(secondStore.getState().documentWorkspace).toBe(beforeCompletion);
  });
});
