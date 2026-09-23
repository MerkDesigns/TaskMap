import type { DatabasePurpose } from "../../domain/document/documentTypes";
import type { DatabaseClient } from "../../platform/database/databaseClient";
import { decodeDatabaseDocument } from "../../platform/database/databaseDocumentCodec";
import type { LoadedDocument } from "../../platform/database/databaseTypes";
import type { PlatformErrorCode, PlatformResult } from "../../platform/platformErrors";
import type { PersistenceScheduler } from "../persistence/persistenceScheduler";
import { createAppStore, type CreateAppStoreOptions } from "../store";

interface DatabaseWorkspaceOptions {
  readonly commandHandlers?: CreateAppStoreOptions["commandHandlers"];
  readonly acceptDocument?: CreateAppStoreOptions["acceptDocument"];
  readonly canEditDocument?: () => boolean;
  readonly databaseClient: Pick<DatabaseClient, "saveDocument">;
  // Supplied by application edition composition, never by a document or picker response.
  readonly expectedPurpose: DatabasePurpose;
  readonly scheduler?: PersistenceScheduler;
  readonly transactionDependencies?: CreateAppStoreOptions["transactionDependencies"];
}

interface AdmittedDatabase {
  readonly epoch: number;
  readonly recoveredFromRevision: number | null;
}

/** Connects confirmed database loads to the existing command/history/autosave core; no IPC on creation. */
export function createDatabaseWorkspace(options: DatabaseWorkspaceOptions) {
  const store = createAppStore({
    commandHandlers: options.commandHandlers,
    acceptDocument: options.acceptDocument,
    canEditDocument: options.canEditDocument,
    transactionDependencies: options.transactionDependencies,
    persistence: { databaseClient: options.databaseClient, scheduler: options.scheduler },
  });

  const admitLoadedDocument = (loaded: LoadedDocument): PlatformResult<AdmittedDatabase> => {
    // A session lifecycle owner must flush/clear the old workspace before replacement.
    if (store.getState().documentWorkspace.document !== null) {
      return rejected("session_already_open", "A document workspace is already loaded.");
    }
    const { session, revision } = loaded;
    if (session.phase !== "unlocked" || !session.sessionId) {
      return rejected("session_locked", "A confirmed unlocked database session is required.");
    }
    const decoded = decodeDatabaseDocument(loaded.serializedDocument);
    if (!decoded.ok) return decoded;
    const document = decoded.value;
    if (document.databasePurpose !== options.expectedPurpose) {
      return rejected(
        "database_purpose_mismatch",
        "The database purpose does not match this edition.",
      );
    }
    const recovered = loaded.recoveredFromRevision ?? null;
    if (
      document.databaseId !== session.databaseId ||
      document.schemaVersion !== session.documentSchemaVersion ||
      !Number.isSafeInteger(revision) ||
      revision < 0 ||
      session.revision !== revision ||
      (recovered !== null &&
        (!Number.isSafeInteger(recovered) || recovered < 0 || recovered >= revision))
    ) {
      return rejected(
        "invalid_document_payload",
        "The document does not match its database session.",
      );
    }
    // Loading is clean and does not schedule an autosave or history entry. Recovery repair is explicit.
    const admitted = store.workspace.load(document, revision);
    if (!admitted.ok) {
      return rejected(
        "invalid_document_payload",
        "The document could not be admitted to the workspace.",
      );
    }
    return { ok: true, value: { epoch: admitted.epoch, recoveredFromRevision: recovered } };
  };

  return { store, admitLoadedDocument };
}

function rejected(code: PlatformErrorCode, message: string): PlatformResult<never> {
  return { ok: false, error: { code, message, retryable: false } };
}
