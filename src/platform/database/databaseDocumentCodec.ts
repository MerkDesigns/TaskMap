import { validateTaskMapDocument } from "../../domain/document/validateDocument";
import type { TaskMapDocument } from "../../domain/document/documentTypes";
import type { PlatformResult } from "../platformErrors";

export function decodeDatabaseDocument(
  serializedDocument: string,
): PlatformResult<TaskMapDocument> {
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
    return validated.ok
      ? { ok: true, value: JSON.stringify(validated.document) }
      : invalidDocumentResult();
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
