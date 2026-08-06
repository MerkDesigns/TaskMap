export type PlatformErrorCode =
  | "already_exists"
  | "file_not_found"
  | "permission_denied"
  | "writer_lock_contention"
  | "unsupported_database_format"
  | "corrupt_database"
  | "wrong_password"
  | "invalid_document_payload"
  | "invalid_input"
  | "database_purpose_mismatch"
  | "session_locked"
  | "session_not_open"
  | "session_already_open"
  | "revision_conflict"
  | "save_failure"
  | "backup_failure"
  | "cancelled"
  | "unexpected";

export interface PlatformError {
  readonly code: PlatformErrorCode;
  readonly message: string;
  readonly retryable: boolean;
}

export type PlatformResult<Value> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly error: PlatformError };
