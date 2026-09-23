import type { TaskMapDocument } from "../../domain/document/documentTypes";
import { acceptsDocument, type DocumentAcceptance } from "../../domain/document/documentAcceptance";
import type { PlatformResult } from "../platformErrors";
import { invokePlatform, invokePlatformRaw } from "../tauriInvoke";
import type { DatabaseClient } from "./databaseClient";
import type { SessionAuthority } from "../settings/preferenceContracts";
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

export function createValidatedDatabaseClient(
  prefix: "app" | "phase2",
  expectedPurpose: TaskMapDocument["databasePurpose"],
  acceptDocument?: DocumentAcceptance,
): DatabaseClient & { getSessionAuthority(): SessionAuthority | null } {
  let sessionId: string | null = null;
  let databaseId: string | null = null;
  const command = (operation: string) => `${prefix}_${operation}`;

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
    if (document.databasePurpose !== expectedPurpose) {
      return {
        ok: false,
        error: {
          code: "database_purpose_mismatch",
          message: "The database purpose does not match this application edition.",
          retryable: false,
        },
      };
    }
    return { ok: true, value: document };
  }

  async function cancelPending(confirmationToken: string) {
    sessionId = null;
    const cancelled = await invokePlatformRaw<DatabaseSessionStatus>(
      command("cancel_pending_unlock"),
      {
        confirmationToken,
      },
    );
    if (!cancelled.ok) await invokePlatform<DatabaseSessionStatus>(command("close_database"));
    return cancelled;
  }

  async function relockAfterValidationFailure() {
    sessionId = null;
    const locked = await invokePlatform<DatabaseSessionStatus>(command("lock_database"));
    if (!locked.ok) await invokePlatform<DatabaseSessionStatus>(command("close_database"));
  }

  async function validateAndConfirmPending(
    result: PlatformResult<PendingLoadedDocument>,
  ): Promise<PlatformResult<LoadedDocument>> {
    if (!result.ok) return result;
    const pending = result.value;
    if (!validLoadSession(pending, "pending_unlock") || !pending.confirmationToken) {
      await cancelPending(pending.confirmationToken);
      return invalidDocument();
    }
    const decoded = decodeDatabaseDocument(pending.serializedDocument);
    const validated = decoded.ok
      ? validateDocumentIdentity(decoded.value, pending.session)
      : decoded;
    if (!validated.ok) {
      await cancelPending(pending.confirmationToken);
      return validated;
    }
    if (!acceptsDocument(validated.value, acceptDocument)) {
      await cancelPending(pending.confirmationToken);
      return invalidDocument();
    }
    const confirmed = await invokePlatformRaw<DatabaseSessionStatus>(command("confirm_unlock"), {
      confirmationToken: pending.confirmationToken,
      databaseId: validated.value.databaseId,
      databasePurpose: validated.value.databasePurpose,
    });
    if (!confirmed.ok) {
      await cancelPending(pending.confirmationToken);
      return confirmed;
    }
    if (
      !validLoadSession({ ...pending, session: confirmed.value }, "unlocked") ||
      confirmed.value.sessionId !== pending.session.sessionId ||
      !validateDocumentIdentity(validated.value, confirmed.value).ok
    ) {
      await invokePlatform<DatabaseSessionStatus>(command("close_database"));
      sessionId = null;
      return invalidDocument();
    }
    sessionId = confirmed.value.sessionId;
    databaseId = confirmed.value.databaseId;
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
    if (!validLoadSession(result.value, "unlocked")) {
      await relockAfterValidationFailure();
      return invalidDocument();
    }
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
    if (!acceptsDocument(decoded.value, acceptDocument)) {
      await relockAfterValidationFailure();
      return invalidDocument();
    }
    sessionId = result.value.session.sessionId;
    databaseId = result.value.session.databaseId;
    return result;
  }

  return {
    getSessionAuthority: () => (sessionId && databaseId ? { sessionId, databaseId } : null),
    async createDatabase(request: CreateDatabaseRequest) {
      const decoded = decodeDatabaseDocument(request.serializedDocument);
      if (
        !decoded.ok ||
        decoded.value.databaseId !== request.databaseId ||
        decoded.value.schemaVersion !== request.documentSchemaVersion ||
        decoded.value.databasePurpose !== expectedPurpose
      ) {
        return decoded.ok
          ? invalidDocument("The document identity or purpose does not match the create request.")
          : decoded;
      }
      if (!acceptsDocument(decoded.value, acceptDocument)) return invalidDocument();
      return validateAndConfirmPending(
        await invokePlatformRaw<PendingLoadedDocument>(command("create_database"), request),
      );
    },

    openDatabase(request: OpenDatabaseRequest) {
      sessionId = null;
      return invokePlatformRaw<SessionOperation>(command("open_database"), request);
    },

    async unlockDatabase(request: UnlockDatabaseRequest) {
      return validateAndConfirmPending(
        await invokePlatformRaw<PendingLoadedDocument>(command("unlock_database"), request),
      );
    },

    async readDocument() {
      return validateLoadedDocument(await invokePlatform<LoadedDocument>(command("read_document")));
    },

    async saveDocument(request: SaveDocumentRequest): Promise<PlatformResult<SavedDocument>> {
      const capturedSessionId = sessionId;
      if (!capturedSessionId)
        return {
          ok: false,
          error: {
            code: "session_locked",
            message: "A validated database session is required.",
            retryable: false,
          },
        };
      const decoded = decodeDatabaseDocument(request.serializedDocument);
      if (!decoded.ok) return decoded;
      if (!acceptsDocument(decoded.value, acceptDocument)) return invalidDocument();
      if (decoded.value.databasePurpose !== expectedPurpose) {
        return invalidDocument("The document purpose does not match this application edition.");
      }
      return invokePlatformRaw<SavedDocument>(command("save_document"), {
        ...request,
        sessionId: capturedSessionId,
        databaseId: decoded.value.databaseId,
        databasePurpose: decoded.value.databasePurpose,
      });
    },

    fullBackup(authorizationToken: string) {
      return invokePlatformRaw<void>(command("full_backup"), { authorizationToken });
    },

    lockDatabase() {
      sessionId = null;
      return invokePlatform<DatabaseSessionStatus>(command("lock_database"));
    },

    closeDatabase() {
      sessionId = null;
      return invokePlatform<DatabaseSessionStatus>(command("close_database"));
    },

    getSessionStatus() {
      return invokePlatform<DatabaseSessionStatus>(command("get_session_status"));
    },

    quitApplication() {
      sessionId = null;
      return invokePlatform<void>(command("quit_application"));
    },
  };
}

function validLoadSession(
  loaded: LoadedDocument | PendingLoadedDocument,
  phase: "unlocked" | "pending_unlock",
) {
  const recovered = loaded.recoveredFromRevision ?? null;
  return (
    loaded.session.phase === phase &&
    !!loaded.session.sessionId &&
    Number.isSafeInteger(loaded.revision) &&
    loaded.revision >= 0 &&
    loaded.session.revision === loaded.revision &&
    (recovered === null ||
      (Number.isSafeInteger(recovered) && recovered >= 0 && recovered < loaded.revision))
  );
}
