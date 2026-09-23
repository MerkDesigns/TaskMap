import type { TaskMapDocument } from "./documentTypes";

// Application-supplied feature policy. The generic document core never imports feature modules.
// Called only after current-version structural/semantic validation, never on pointer samples.
export type DocumentAcceptance = (document: TaskMapDocument) => boolean;

export function acceptsDocument(
  document: TaskMapDocument,
  acceptDocument?: DocumentAcceptance,
): boolean {
  try {
    return acceptDocument === undefined || acceptDocument(document) === true;
  } catch {
    // A policy failure must not publish content or expose exception/document text.
    return false;
  }
}
