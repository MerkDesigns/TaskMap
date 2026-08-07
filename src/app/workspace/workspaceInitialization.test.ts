// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createCommandTestDocument } from "../../domain/commands/commandTestSupport";
import { selectIsDocumentDirty } from "../selectors/workspaceSelectors";
import {
  createWorkspaceTestStore,
  FakePersistenceScheduler,
  loadTestWorkspace,
  renameCommand,
  savedDocument,
} from "./workspaceTestSupport";

describe("document workspace loading", () => {
  it("loads a validated document and revision with clean history and sequences", () => {
    const store = createWorkspaceTestStore();
    const source = createCommandTestDocument();

    const result = store.workspace.load(source, 4);

    expect(result).toMatchObject({ ok: true, epoch: 1 });
    expect(store.getState().documentWorkspace).toMatchObject({
      backendRevision: 4,
      localChangeSequence: 0,
      persistedChangeSequence: 0,
      history: { past: [], future: [] },
      savePhase: "unavailable",
    });
    expect(selectIsDocumentDirty(store.getState())).toBe(false);
    expect(store.getState().documentWorkspace.document).not.toBe(source);
  });

  it("rejects invalid documents and revisions without partially replacing current state", () => {
    const store = createWorkspaceTestStore();
    loadTestWorkspace(store);
    const before = store.getState().documentWorkspace;

    expect(store.workspace.load({ schemaVersion: 1 }, 5)).toMatchObject({
      ok: false,
      code: "invalid-document",
    });
    expect(store.getState().documentWorkspace).toBe(before);
    expect(store.workspace.load(createCommandTestDocument(), -1)).toMatchObject({
      ok: false,
      code: "invalid-revision",
    });
    expect(
      store.workspace.load(createCommandTestDocument(), Number.MAX_SAFE_INTEGER + 1),
    ).toMatchObject({ ok: false, code: "invalid-revision" });
    expect(store.getState().documentWorkspace).toBe(before);
  });

  it("replacing a workspace increments the epoch, resets history, and clears conflict state", async () => {
    const scheduler = new FakePersistenceScheduler();
    const saveDocument = vi.fn(async () => ({
      ok: false as const,
      error: { code: "revision_conflict" as const, message: "unsafe detail", retryable: false },
    }));
    const store = createWorkspaceTestStore({ databaseClient: { saveDocument }, scheduler });
    loadTestWorkspace(store);
    store.workspace.dispatchCommand(renameCommand("Changed"));
    scheduler.runNext();
    await Promise.resolve();
    await Promise.resolve();
    expect(store.getState().documentWorkspace.savePhase).toBe("conflict");

    const replacement = store.workspace.load(createCommandTestDocument(), 9);

    expect(replacement).toMatchObject({ ok: true, epoch: 2 });
    expect(store.getState().documentWorkspace).toMatchObject({
      history: { past: [], future: [] },
      revisionConflict: null,
      persistenceError: null,
      backendRevision: 9,
      savePhase: "clean",
    });
  });

  it("clear removes document and history, cancels a timer, and advances the epoch", () => {
    const scheduler = new FakePersistenceScheduler();
    const store = createWorkspaceTestStore({
      databaseClient: { saveDocument: vi.fn(async () => savedDocument(5)) },
      scheduler,
    });
    loadTestWorkspace(store);
    store.workspace.dispatchCommand(renameCommand("Changed"));
    expect(scheduler.size).toBe(1);

    store.workspace.clear();

    expect(scheduler.size).toBe(0);
    expect(store.getState().documentWorkspace).toMatchObject({
      document: null,
      history: { past: [], future: [] },
      backendRevision: null,
      epoch: 2,
      savePhase: "unavailable",
    });
  });
});
