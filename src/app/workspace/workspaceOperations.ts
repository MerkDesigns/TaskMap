import type { TransactionDependencies } from "../../domain/commands/executeDocumentCommand";
import { coreDocumentCommandHandlers } from "../../domain/commands/core/coreDocumentCommandHandlers";
import { validateTaskMapDocument } from "../../domain/document/validateDocument";
import { recordTransaction, redoDocument, undoDocument } from "../../domain/history/historyEngine";
import type { HistoryCapacity, HistoryIssue } from "../../domain/history/historyTypes";
import type { CommandIssue } from "../../domain/commands/commandResult";
import type { TaskMapDocument } from "../../domain/document/documentTypes";
import type { DocumentPersistenceCoordinator } from "../persistence/documentPersistenceCoordinator";
import { createCommandDispatcher } from "../commands/commandDispatcher";
import { workspaceActions } from "./workspaceSlice";
import type {
  DocumentWorkspaceState,
  LoadWorkspaceResult,
  WorkspaceCommandResult,
  WorkspaceHistoryResult,
} from "./workspaceTypes";

interface WorkspaceStore {
  getState(): { readonly documentWorkspace: DocumentWorkspaceState };
  dispatch(action: ReturnType<(typeof workspaceActions)[keyof typeof workspaceActions]>): unknown;
}

export interface LoadWorkspaceOptions {
  readonly autosavePermitted?: boolean;
}

export interface WorkspaceOperations {
  load(
    document: unknown,
    backendRevision: number,
    options?: LoadWorkspaceOptions,
  ): LoadWorkspaceResult;
  clear(): void;
  dispatchCommand(command: unknown): WorkspaceCommandResult;
  undo(): WorkspaceHistoryResult;
  redo(): WorkspaceHistoryResult;
  retrySave(): Promise<void>;
  flushSave(): Promise<void>;
  cancelScheduledPersistence(): void;
}

export function createWorkspaceOperations(
  store: WorkspaceStore,
  transactionDependencies: TransactionDependencies,
  persistence: DocumentPersistenceCoordinator | null,
  historyCapacity: HistoryCapacity = {},
): WorkspaceOperations {
  const commandDispatcher = createCommandDispatcher(
    coreDocumentCommandHandlers,
    transactionDependencies,
  );

  const commitDocumentChange = (
    document: TaskMapDocument,
    history: DocumentWorkspaceState["history"],
  ) => {
    store.dispatch(workspaceActions.workspaceDocumentChanged({ document, history }));
    persistence?.documentChanged();
  };

  const runHistory = (operation: "undo" | "redo"): WorkspaceHistoryResult => {
    const current = store.getState().documentWorkspace;
    if (current.document === null) return historyUnavailable(operation);
    const result =
      operation === "undo"
        ? undoDocument(current.document, current.history)
        : redoDocument(current.document, current.history);
    if (!result.ok) return { ok: false, code: "history-failed", issues: result.issues };
    if (result.changed) commitDocumentChange(result.document, result.history);
    return result;
  };

  return {
    load(document, backendRevision, options = {}) {
      const validation = validateTaskMapDocument(document);
      if (!validation.ok) {
        return {
          ok: false,
          code: "invalid-document",
          message: "The loaded document failed current-version validation.",
        };
      }
      if (!Number.isSafeInteger(backendRevision) || backendRevision < 0) {
        return {
          ok: false,
          code: "invalid-revision",
          message: "The backend revision must be a non-negative safe integer.",
        };
      }
      persistence?.workspaceReplaced();
      const autosavePermitted = persistence !== null && (options.autosavePermitted ?? true);
      store.dispatch(
        workspaceActions.workspaceLoaded({
          document: validation.document,
          backendRevision,
          autosavePermitted,
        }),
      );
      const loaded = store.getState().documentWorkspace;
      return { ok: true, document: validation.document, epoch: loaded.epoch };
    },
    clear() {
      persistence?.workspaceReplaced();
      store.dispatch(workspaceActions.workspaceCleared());
    },
    dispatchCommand(command) {
      const current = store.getState().documentWorkspace;
      if (current.document === null) return commandUnavailable();
      const result = commandDispatcher.dispatch(command, current.document);
      if (!result.ok) return { ok: false, code: "command-failed", issues: result.issues };
      if (result.document === current.document) {
        return { ok: true, changed: false, document: current.document };
      }
      const history =
        result.transaction === null
          ? current.history
          : recordTransaction(current.history, result.transaction, historyCapacity);
      commitDocumentChange(result.document, history);
      return { ok: true, changed: true, document: result.document };
    },
    undo: () => runHistory("undo"),
    redo: () => runHistory("redo"),
    retrySave: () => persistence?.retry() ?? Promise.resolve(),
    flushSave: () => persistence?.flush() ?? Promise.resolve(),
    cancelScheduledPersistence: () => persistence?.cancelScheduled(),
  };
}

function commandUnavailable(): WorkspaceCommandResult {
  const issue: CommandIssue = {
    code: "command-rejected",
    path: "workspace",
    message: "No document workspace is loaded.",
  };
  return { ok: false, code: "workspace-not-loaded", issues: [issue] };
}

function historyUnavailable(operation: "undo" | "redo"): WorkspaceHistoryResult {
  const issue: HistoryIssue = {
    code: "history-document-invalid",
    operation,
    message: "No document workspace is loaded.",
  };
  return { ok: false, code: "workspace-not-loaded", issues: [issue] };
}
