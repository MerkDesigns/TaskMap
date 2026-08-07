import type { TaskMapDocument } from "../../domain/document/documentTypes";
import type { HistoryIssue, HistoryState } from "../../domain/history/historyTypes";
import type { PlatformErrorCode } from "../../platform/platformErrors";
import type { CommandIssue } from "../../domain/commands/commandResult";

export type WorkspaceSavePhase =
  "unavailable" | "clean" | "scheduled" | "saving" | "dirty" | "failed" | "conflict";

export interface WorkspacePersistenceError {
  readonly code: PlatformErrorCode;
  readonly message: string;
  readonly retryable: boolean;
}

export interface WorkspaceRevisionConflict {
  readonly expectedRevision: number;
  readonly message: string;
}

export interface DocumentWorkspaceState {
  readonly document: TaskMapDocument | null;
  readonly history: HistoryState;
  readonly backendRevision: number | null;
  readonly localChangeSequence: number;
  readonly persistedChangeSequence: number;
  readonly epoch: number;
  readonly savePhase: WorkspaceSavePhase;
  readonly persistenceError: WorkspacePersistenceError | null;
  readonly revisionConflict: WorkspaceRevisionConflict | null;
  readonly autosavePermitted: boolean;
  readonly saveScheduled: boolean;
  readonly saveInFlight: boolean;
}

export type LoadWorkspaceResult =
  | { readonly ok: true; readonly document: TaskMapDocument; readonly epoch: number }
  | {
      readonly ok: false;
      readonly code: "invalid-document" | "invalid-revision";
      readonly message: string;
    };

export type WorkspaceCommandResult =
  | {
      readonly ok: true;
      readonly changed: boolean;
      readonly document: TaskMapDocument;
    }
  | {
      readonly ok: false;
      readonly code: "workspace-not-loaded" | "command-failed";
      readonly issues: readonly CommandIssue[];
    };

export type WorkspaceHistoryResult =
  | {
      readonly ok: true;
      readonly changed: boolean;
      readonly document: TaskMapDocument;
      readonly history: HistoryState;
    }
  | {
      readonly ok: false;
      readonly code: "workspace-not-loaded" | "history-failed";
      readonly issues: readonly HistoryIssue[];
    };
