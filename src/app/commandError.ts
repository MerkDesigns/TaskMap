export type CommandErrorCode =
  | "missing_key"
  | "decrypt_failed"
  | "invalid_data"
  | "invalid_export"
  | "resource_limit"
  | "not_found"
  | "io"
  | "database"
  | "keyring"
  | "internal";

export type CommandError = {
  code?: CommandErrorCode;
  message: string;
};

const COMMAND_ERROR_CODES = new Set<CommandErrorCode>([
  "missing_key",
  "decrypt_failed",
  "invalid_data",
  "invalid_export",
  "resource_limit",
  "not_found",
  "io",
  "database",
  "keyring",
  "internal",
]);

export const parseCommandError = (value: unknown): CommandError => {
  if (value instanceof Error) {
    return { message: value.message };
  }

  if (typeof value === "string") {
    return { message: value };
  }

  if (value && typeof value === "object") {
    const candidate = value as { code?: unknown; message?: unknown };
    const code =
      typeof candidate.code === "string" &&
      COMMAND_ERROR_CODES.has(candidate.code as CommandErrorCode)
        ? (candidate.code as CommandErrorCode)
        : undefined;
    if (typeof candidate.message === "string") {
      return { code, message: candidate.message };
    }
  }

  try {
    return { message: JSON.stringify(value) ?? String(value) };
  } catch {
    return { message: String(value) };
  }
};

export const commandErrorMessage = (value: unknown) => parseCommandError(value).message;

export const isRecoverableStorageError = (value: unknown) => {
  const error = parseCommandError(value);
  if (error.code) {
    return error.code === "missing_key" || error.code === "decrypt_failed";
  }

  // Compatibility with pre-structured backend errors while older builds or
  // stored failures can still surface them.
  return (
    error.message.includes("database key no longer matches") ||
    error.message.includes("no database key was found")
  );
};
