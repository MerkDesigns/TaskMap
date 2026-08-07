import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { TaskMapDocument } from "../../domain/document/documentTypes";
import { createEmptyHistory } from "../../domain/history/historyEngine";
import type { HistoryState } from "../../domain/history/historyTypes";
import type {
  DocumentWorkspaceState,
  WorkspacePersistenceError,
  WorkspaceRevisionConflict,
  WorkspaceSavePhase,
} from "./workspaceTypes";

export const initialDocumentWorkspaceState: DocumentWorkspaceState = {
  document: null,
  history: createEmptyHistory(),
  backendRevision: null,
  localChangeSequence: 0,
  persistedChangeSequence: 0,
  epoch: 0,
  savePhase: "unavailable",
  persistenceError: null,
  revisionConflict: null,
  autosavePermitted: false,
  saveScheduled: false,
  saveInFlight: false,
};

export const documentWorkspaceSlice = createSlice({
  name: "documentWorkspace",
  initialState: initialDocumentWorkspaceState,
  reducers: {
    workspaceLoaded(
      state,
      action: PayloadAction<{
        document: TaskMapDocument;
        backendRevision: number;
        autosavePermitted: boolean;
      }>,
    ) {
      return {
        document: action.payload.document,
        history: createEmptyHistory(),
        backendRevision: action.payload.backendRevision,
        localChangeSequence: 0,
        persistedChangeSequence: 0,
        epoch: state.epoch + 1,
        savePhase: action.payload.autosavePermitted ? "clean" : "unavailable",
        persistenceError: null,
        revisionConflict: null,
        autosavePermitted: action.payload.autosavePermitted,
        saveScheduled: false,
        saveInFlight: false,
      };
    },
    workspaceCleared(state) {
      return { ...initialDocumentWorkspaceState, epoch: state.epoch + 1 };
    },
    workspaceDocumentChanged(
      state,
      action: PayloadAction<{ document: TaskMapDocument; history: HistoryState }>,
    ) {
      if (state.document === null) return;
      const savePhase =
        state.revisionConflict !== null
          ? "conflict"
          : state.autosavePermitted
            ? "dirty"
            : "unavailable";
      return {
        document: action.payload.document,
        history: action.payload.history,
        backendRevision: state.backendRevision,
        localChangeSequence: state.localChangeSequence + 1,
        persistedChangeSequence: state.persistedChangeSequence,
        epoch: state.epoch,
        savePhase,
        persistenceError: state.revisionConflict === null ? null : state.persistenceError,
        revisionConflict: state.revisionConflict,
        autosavePermitted: state.autosavePermitted,
        saveScheduled: false,
        saveInFlight: state.saveInFlight,
      };
    },
    persistenceScheduled(state, action: PayloadAction<{ epoch: number }>) {
      if (
        state.epoch !== action.payload.epoch ||
        state.document === null ||
        !state.autosavePermitted ||
        state.revisionConflict !== null
      )
        return;
      if (state.localChangeSequence === state.persistedChangeSequence) return;
      state.saveScheduled = true;
      state.savePhase = "scheduled";
    },
    persistenceScheduleCancelled(state, action: PayloadAction<{ epoch: number }>) {
      if (state.epoch !== action.payload.epoch || !state.saveScheduled) return;
      state.saveScheduled = false;
      state.savePhase = dirtyPhase(state);
    },
    persistenceStarted(state, action: PayloadAction<{ epoch: number }>) {
      if (
        state.epoch !== action.payload.epoch ||
        state.document === null ||
        !state.autosavePermitted ||
        state.revisionConflict !== null
      )
        return;
      state.saveScheduled = false;
      state.saveInFlight = true;
      state.savePhase = "saving";
    },
    persistenceSucceeded(
      state,
      action: PayloadAction<{ epoch: number; sequence: number; backendRevision: number }>,
    ) {
      if (state.epoch !== action.payload.epoch || state.document === null) return;
      state.backendRevision = action.payload.backendRevision;
      state.persistedChangeSequence = Math.max(
        state.persistedChangeSequence,
        action.payload.sequence,
      );
      state.saveInFlight = false;
      state.saveScheduled = false;
      state.persistenceError = null;
      state.savePhase = dirtyPhase(state);
    },
    persistenceFailed(
      state,
      action: PayloadAction<{
        epoch: number;
        error: WorkspacePersistenceError;
        conflict: WorkspaceRevisionConflict | null;
      }>,
    ) {
      if (state.epoch !== action.payload.epoch || state.document === null) return;
      state.saveInFlight = false;
      state.saveScheduled = false;
      state.persistenceError = action.payload.error;
      state.revisionConflict = action.payload.conflict;
      state.savePhase = action.payload.conflict === null ? "failed" : "conflict";
    },
  },
});

function dirtyPhase(
  state: Pick<
    DocumentWorkspaceState,
    "revisionConflict" | "autosavePermitted" | "localChangeSequence" | "persistedChangeSequence"
  >,
): WorkspaceSavePhase {
  if (state.revisionConflict !== null) return "conflict";
  if (!state.autosavePermitted) return "unavailable";
  return state.localChangeSequence === state.persistedChangeSequence ? "clean" : "dirty";
}

export const workspaceActions = documentWorkspaceSlice.actions;
