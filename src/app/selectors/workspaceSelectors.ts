import type { RootState } from "../store";

const selectWorkspace = (state: RootState) => state.documentWorkspace;

export const selectCurrentDocument = (state: RootState) => selectWorkspace(state).document;
export const selectIsWorkspaceLoaded = (state: RootState) =>
  selectWorkspace(state).document !== null;
export const selectCurrentHistory = (state: RootState) => selectWorkspace(state).history;
export const selectCanUndo = (state: RootState) => selectWorkspace(state).history.past.length > 0;
export const selectCanRedo = (state: RootState) => selectWorkspace(state).history.future.length > 0;
export const selectBackendRevision = (state: RootState) => selectWorkspace(state).backendRevision;
export const selectLocalChangeSequence = (state: RootState) =>
  selectWorkspace(state).localChangeSequence;
export const selectPersistedChangeSequence = (state: RootState) =>
  selectWorkspace(state).persistedChangeSequence;
export const selectIsDocumentDirty = (state: RootState) => {
  const workspace = selectWorkspace(state);
  return (
    workspace.document !== null &&
    workspace.localChangeSequence !== workspace.persistedChangeSequence
  );
};
export const selectSavePhase = (state: RootState) => selectWorkspace(state).savePhase;
export const selectPersistenceError = (state: RootState) => selectWorkspace(state).persistenceError;
export const selectRevisionConflict = (state: RootState) => selectWorkspace(state).revisionConflict;
export const selectIsAutosavePermitted = (state: RootState) =>
  selectWorkspace(state).autosavePermitted;
export const selectIsAutomaticSavingBlocked = (state: RootState) => {
  const workspace = selectWorkspace(state);
  return !workspace.autosavePermitted || workspace.revisionConflict !== null;
};
export const selectIsSaveScheduled = (state: RootState) => selectWorkspace(state).saveScheduled;
export const selectIsSaveInFlight = (state: RootState) => selectWorkspace(state).saveInFlight;
export const selectWorkspaceEpoch = (state: RootState) => selectWorkspace(state).epoch;
