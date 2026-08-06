import { invoke } from "@tauri-apps/api/core";
import type { PlatformError, PlatformErrorCode, PlatformResult } from "./platformErrors";

const ERROR_CODES: ReadonlySet<PlatformErrorCode> = new Set([
  "already_exists",
  "file_not_found",
  "permission_denied",
  "writer_lock_contention",
  "unsupported_database_format",
  "corrupt_database",
  "wrong_password",
  "invalid_document_payload",
  "invalid_input",
  "database_purpose_mismatch",
  "session_locked",
  "session_not_open",
  "session_already_open",
  "revision_conflict",
  "save_failure",
  "backup_failure",
  "cancelled",
  "unexpected",
]);

export async function invokePlatform<Value>(
  command: string,
  args?: Record<string, unknown>,
): Promise<PlatformResult<Value>> {
  try {
    return { ok: true, value: await invoke<Value>(command, args) };
  } catch (error) {
    return { ok: false, error: mapInvokeError(error) };
  }
}

export async function invokePlatformRaw<Value>(
  command: string,
  payload: unknown,
): Promise<PlatformResult<Value>> {
  try {
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    return { ok: true, value: await invoke<Value>(command, bytes) };
  } catch (error) {
    return { ok: false, error: mapInvokeError(error) };
  }
}

function mapInvokeError(error: unknown): PlatformError {
  if (isRecord(error)) {
    const code = error.code;
    const message = error.message;
    const retryable = error.retryable;
    if (
      typeof code === "string" &&
      ERROR_CODES.has(code as PlatformErrorCode) &&
      typeof message === "string" &&
      typeof retryable === "boolean"
    ) {
      return { code: code as PlatformErrorCode, message, retryable };
    }
  }
  return {
    code: "unexpected",
    message: "The operation could not be completed.",
    retryable: false,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
