import type { TaskMapDocument } from "../../domain/document/documentTypes";
import type { PlatformResult } from "../platformErrors";
import { invokePlatform, invokePlatformRaw } from "../tauriInvoke";
import type { DatabaseClient } from "./databaseClient";
import { decodeDatabaseDocument } from "./databaseDocumentCodec";
import type {
  CreateDatabaseRequest,
  DatabaseSessionStatus,
  LoadedDocument,
  OpenDatabaseRequest,
  PendingLoadedDocument,
  SaveDocumentRequest,
  SavedDocument,
  SessionOperation,
  UnlockDatabaseRequest,
} from "./databaseTypes";

const DEVELOPMENT_PURPOSE = "development";

function invalidDocument<Value>(
  message = "The document payload is invalid.",
): PlatformResult<Value> {
  return {
    ok: false,
    error: { code: "invalid_document_payload", message, retryable: false },
  };
}

function validateDocumentIdentity(
  document: TaskMapDocument,
  session: DatabaseSessionStatus,
): PlatformResult<TaskMapDocument> {
  if (
    document.databaseId !== session.databaseId ||
    document.schemaVersion !== session.documentSchemaVersion
  ) {
    return invalidDocument("The decrypted document does not match the database envelope.");
  }
  if (document.databasePurpose !== DEVELOPMENT_PURPOSE) {
    return {
      ok: false,
      error: {
        code: "database_purpose_mismatch",
        message: "The development edition only accepts development-purpose databases.",
        retryable: false,
      },
    };
  }
  return { ok: true, value: document };
}

async function cancelPending(confirmationToken: string) {
  const cancelled = await invokePlatformRaw<DatabaseSessionStatus>("phase2_cancel_pending_unlock", {
    confirmationToken,
  });
  if (!cancelled.ok) await invokePlatform<DatabaseSessionStatus>("phase2_close_database");
  return cancelled;
}

async function relockAfterValidationFailure() {
  const locked = await invokePlatform<DatabaseSessionStatus>("phase2_lock_database");
  if (!locked.ok) await invokePlatform<DatabaseSessionStatus>("phase2_close_database");
}

async function validateAndConfirmPending(
  result: PlatformResult<PendingLoadedDocument>,
): Promise<PlatformResult<LoadedDocument>> {
  if (!result.ok) return result;
  const pending = result.value;
  const decoded = decodeDatabaseDocument(pending.serializedDocument);
  const validated = decoded.ok ? validateDocumentIdentity(decoded.value, pending.session) : decoded;
  if (!validated.ok) {
    await cancelPending(pending.confirmationToken);
    return validated;
  }
  const confirmed = await invokePlatformRaw<DatabaseSessionStatus>("phase2_confirm_unlock", {
    confirmationToken: pending.confirmationToken,
    databaseId: validated.value.databaseId,
    databasePurpose: validated.value.databasePurpose,
  });
  if (!confirmed.ok) {
    await cancelPending(pending.confirmationToken);
    return confirmed;
  }
  return {
    ok: true,
    value: {
      serializedDocument: pending.serializedDocument,
      revision: pending.revision,
      session: confirmed.value,
      recoveredFromRevision: pending.recoveredFromRevision,
      warnings: pending.warnings,
    },
  };
}

async function validateLoadedDocument(
  result: PlatformResult<LoadedDocument>,
): Promise<PlatformResult<LoadedDocument>> {
  if (!result.ok) return result;
  const decoded = decodeDatabaseDocument(result.value.serializedDocument);
  if (!decoded.ok) {
    await relockAfterValidationFailure();
    return decoded;
  }
  const identity = validateDocumentIdentity(decoded.value, result.value.session);
  if (!identity.ok) {
    await relockAfterValidationFailure();
    return identity;
  }
  return result;
}

export const tauriDatabaseClient: DatabaseClient = {
  async createDatabase(request: CreateDatabaseRequest) {
    const decoded = decodeDatabaseDocument(request.serializedDocument);
    if (
      !decoded.ok ||
      decoded.value.databaseId !== request.databaseId ||
      decoded.value.databasePurpose !== DEVELOPMENT_PURPOSE
    ) {
      return decoded.ok
        ? invalidDocument("The document identity or purpose does not match the create request.")
        : decoded;
    }
    return validateAndConfirmPending(
      await invokePlatformRaw<PendingLoadedDocument>("phase2_create_database", request),
    );
  },

  openDatabase(request: OpenDatabaseRequest) {
    return invokePlatformRaw<SessionOperation>("phase2_open_database", request);
  },

  async unlockDatabase(request: UnlockDatabaseRequest) {
    return validateAndConfirmPending(
      await invokePlatformRaw<PendingLoadedDocument>("phase2_unlock_database", request),
    );
  },

  async readDocument() {
    return validateLoadedDocument(await invokePlatform<LoadedDocument>("phase2_read_document"));
  },

  async saveDocument(request: SaveDocumentRequest): Promise<PlatformResult<SavedDocument>> {
    const decoded = decodeDatabaseDocument(request.serializedDocument);
    if (!decoded.ok) return decoded;
    if (decoded.value.databasePurpose !== DEVELOPMENT_PURPOSE) {
      return invalidDocument("The development edition cannot save a production-purpose document.");
    }
    return invokePlatformRaw<SavedDocument>("phase2_save_document", {
      ...request,
      databaseId: decoded.value.databaseId,
      databasePurpose: decoded.value.databasePurpose,
    });
  },

  fullBackup(authorizationToken: string) {
    return invokePlatformRaw<void>("phase2_full_backup", { authorizationToken });
  },

  lockDatabase() {
    return invokePlatform<DatabaseSessionStatus>("phase2_lock_database");
  },

  closeDatabase() {
    return invokePlatform<DatabaseSessionStatus>("phase2_close_database");
  },

  getSessionStatus() {
    return invokePlatform<DatabaseSessionStatus>("phase2_get_session_status");
  },

  quitApplication() {
    return invokePlatform<void>("phase2_quit_application");
  },
};
