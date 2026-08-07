import type { PlatformError, PlatformErrorCode } from "../../platform/platformErrors";
import type { WorkspacePersistenceError } from "../workspace/workspaceTypes";

const SAFE_MESSAGES: Readonly<Record<PlatformErrorCode, string>> = {
  already_exists: "The database already exists.",
  file_not_found: "The database could not be found.",
  permission_denied: "Permission to save the database was denied.",
  writer_lock_contention: "Another process owns the database writer lock.",
  unsupported_database_format: "The database format is not supported.",
  corrupt_database: "The database is corrupt.",
  wrong_password: "The database credentials were rejected.",
  invalid_document_payload: "The document could not be encoded for saving.",
  invalid_input: "The save request was invalid.",
  database_purpose_mismatch: "The database purpose does not match this application.",
  session_locked: "The database session is locked.",
  session_not_open: "The database session is not open.",
  session_already_open: "A database session is already open.",
  revision_conflict: "The database changed outside this workspace.",
  save_failure: "The encrypted document could not be saved.",
  backup_failure: "The database backup failed.",
  cancelled: "The save was cancelled.",
  unexpected: "An unexpected persistence failure occurred.",
};

export function sanitizePersistenceError(error: PlatformError): WorkspacePersistenceError {
  return {
    code: error.code,
    message: SAFE_MESSAGES[error.code],
    retryable: error.code === "revision_conflict" ? false : error.retryable,
  };
}

export function unexpectedPersistenceError(): WorkspacePersistenceError {
  return { code: "unexpected", message: SAFE_MESSAGES.unexpected, retryable: false };
}
