import type { PlatformErrorCode } from "../../platform/platformErrors";

export function databaseEntryError(code: PlatformErrorCode): string {
  const messages: Partial<Record<PlatformErrorCode, string>> = {
    wrong_password: "That password did not unlock this database. Check it and try again.",
    writer_lock_contention:
      "This database is already open in another TaskMap session. Close it there first.",
    file_not_found: "The database could not be found. Choose its current location.",
    already_exists:
      "A file already exists at that location. Choose another name; nothing was overwritten.",
    database_purpose_mismatch:
      "This database belongs to the other TaskMap edition. Stable and development data stay separate.",
    unsupported_database_format:
      "This database format is not supported. Old TaskMap data must be converted separately, not opened here.",
    corrupt_database:
      "The database could not be read safely. Keep the original file and use a known-good backup.",
    invalid_document_payload:
      "The document could not be validated. It has not been opened for editing.",
    permission_denied: "TaskMap does not have permission for this operation.",
    revision_conflict:
      "The saved data changed elsewhere. Your workspace has been kept; resolve the conflict before closing.",
    save_failure: "Saving did not complete. Your workspace has been kept. Retry before closing.",
    session_locked: "The database session was locked. Unlock it again to continue.",
    session_not_open: "The database session is no longer available. Choose the database again.",
    invalid_input: "Check the selected file and password, then try again.",
  };
  return (
    messages[code] ??
    "The operation could not complete safely. Retry, or close this database session."
  );
}
