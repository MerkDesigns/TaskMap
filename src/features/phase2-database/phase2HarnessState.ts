import type { TaskMapDocument } from "../../domain/document/documentTypes";
import type { DatabaseSessionStatus } from "../../platform/database/databaseTypes";

export interface Phase2HarnessState {
  readonly session: DatabaseSessionStatus;
  readonly document: TaskMapDocument | null;
  readonly error: string | null;
}

export type Phase2HarnessAction =
  | { readonly type: "sessionReceived"; readonly session: DatabaseSessionStatus }
  | {
      readonly type: "documentReceived";
      readonly session: DatabaseSessionStatus;
      readonly document: TaskMapDocument;
    }
  | { readonly type: "documentEdited"; readonly document: TaskMapDocument }
  | { readonly type: "operationFailed"; readonly message: string }
  | { readonly type: "clearError" };

export const CLOSED_DATABASE_SESSION: DatabaseSessionStatus = {
  phase: "closed",
  sessionId: null,
  databasePath: null,
  databaseId: null,
  documentSchemaVersion: null,
  revision: null,
  lastActivityAt: null,
};

export const INITIAL_PHASE2_HARNESS_STATE: Phase2HarnessState = {
  session: CLOSED_DATABASE_SESSION,
  document: null,
  error: null,
};

export function phase2HarnessReducer(
  state: Phase2HarnessState,
  action: Phase2HarnessAction,
): Phase2HarnessState {
  switch (action.type) {
    case "sessionReceived":
      return {
        session: action.session,
        document: action.session.phase === "unlocked" ? state.document : null,
        error: null,
      };
    case "documentReceived":
      return { session: action.session, document: action.document, error: null };
    case "documentEdited":
      return state.session.phase === "unlocked" ? { ...state, document: action.document } : state;
    case "operationFailed":
      return { ...state, error: action.message };
    case "clearError":
      return { ...state, error: null };
  }
}
