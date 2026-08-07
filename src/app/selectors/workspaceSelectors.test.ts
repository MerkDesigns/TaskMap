// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  selectBackendRevision,
  selectCanRedo,
  selectCanUndo,
  selectCurrentDocument,
  selectCurrentHistory,
  selectIsAutomaticSavingBlocked,
  selectIsAutosavePermitted,
  selectIsDocumentDirty,
  selectIsSaveInFlight,
  selectIsSaveScheduled,
  selectIsWorkspaceLoaded,
  selectLocalChangeSequence,
  selectPersistedChangeSequence,
  selectPersistenceError,
  selectRevisionConflict,
  selectSavePhase,
  selectWorkspaceEpoch,
} from "./workspaceSelectors";
import {
  createWorkspaceTestStore,
  FakePersistenceScheduler,
  loadTestWorkspace,
  renameCommand,
  savedDocument,
} from "../workspace/workspaceTestSupport";

describe("workspace selectors", () => {
  it("reports document, history, dirty, revision, and persistence lifecycle without cloning", () => {
    const scheduler = new FakePersistenceScheduler();
    const store = createWorkspaceTestStore({
      databaseClient: { saveDocument: vi.fn(async () => savedDocument(5)) },
      scheduler,
    });
    loadTestWorkspace(store, 4);
    let state = store.getState();

    expect(selectCurrentDocument(state)).toBe(state.documentWorkspace.document);
    expect(selectCurrentHistory(state)).toBe(state.documentWorkspace.history);
    expect(selectIsWorkspaceLoaded(state)).toBe(true);
    expect(selectCanUndo(state)).toBe(false);
    expect(selectCanRedo(state)).toBe(false);
    expect(selectBackendRevision(state)).toBe(4);
    expect(selectLocalChangeSequence(state)).toBe(0);
    expect(selectPersistedChangeSequence(state)).toBe(0);
    expect(selectIsDocumentDirty(state)).toBe(false);
    expect(selectSavePhase(state)).toBe("clean");
    expect(selectPersistenceError(state)).toBeNull();
    expect(selectRevisionConflict(state)).toBeNull();
    expect(selectIsAutosavePermitted(state)).toBe(true);
    expect(selectIsAutomaticSavingBlocked(state)).toBe(false);
    expect(selectIsSaveScheduled(state)).toBe(false);
    expect(selectIsSaveInFlight(state)).toBe(false);
    expect(selectWorkspaceEpoch(state)).toBe(1);

    store.workspace.dispatchCommand(renameCommand("Changed"));
    state = store.getState();
    expect(selectCanUndo(state)).toBe(true);
    expect(selectIsDocumentDirty(state)).toBe(true);
    expect(selectLocalChangeSequence(state)).toBe(1);
    expect(selectPersistedChangeSequence(state)).toBe(0);
    expect(selectSavePhase(state)).toBe("scheduled");
    expect(selectIsSaveScheduled(state)).toBe(true);
  });
});
