import { validateTaskMapDocument } from "../../domain/document/validateDocument";
import type { TaskMapDocument } from "../../domain/document/documentTypes";
import type { PlatformResult } from "../platformErrors";

// The last document this codec encoded. A save encodes the document and the database client
// decodes that same text again to check it before writing; answering that decode from here saves
// a parse and a full validation of the whole document on every save.
let lastEncoded: { readonly text: string; readonly document: TaskMapDocument } | null = null;

export function decodeDatabaseDocument(
  serializedDocument: string,
): PlatformResult<TaskMapDocument> {
  if (lastEncoded?.text === serializedDocument) return { ok: true, value: lastEncoded.document };
  try {
    const validated = validateTaskMapDocument(JSON.parse(serializedDocument));
    return validated.ok ? { ok: true, value: validated.document } : invalidDocumentResult();
  } catch {
    return invalidDocumentResult();
  }
}

export function encodeDatabaseDocument(document: TaskMapDocument): PlatformResult<string> {
  try {
    const validated = validateTaskMapDocument(document);
    if (!validated.ok) return invalidDocumentResult();
    const text = JSON.stringify(validated.document);
    lastEncoded = { text, document: validated.document };
    return { ok: true, value: text };
  } catch {
    return invalidDocumentResult();
  }
}

function invalidDocumentResult<Value>(): PlatformResult<Value> {
  return {
    ok: false,
    error: {
      code: "invalid_document_payload",
      message: "The document payload is invalid.",
      retryable: false,
    },
  };
}
