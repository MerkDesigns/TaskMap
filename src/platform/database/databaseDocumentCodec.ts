import { inspectDocumentInvariants } from "../../domain/document/documentInvariants";
import { parseTaskMapDocument } from "../../domain/document/documentSchema";
import type { TaskMapDocument } from "../../domain/document/documentTypes";
import type { PlatformResult } from "../platformErrors";

export function decodeDatabaseDocument(
  serializedDocument: string,
): PlatformResult<TaskMapDocument> {
  try {
    const document = parseTaskMapDocument(JSON.parse(serializedDocument));
    if (inspectDocumentInvariants(document).length > 0) {
      return invalidDocumentResult();
    }
    return { ok: true, value: document };
  } catch {
    return invalidDocumentResult();
  }
}

export function encodeDatabaseDocument(document: TaskMapDocument): PlatformResult<string> {
  try {
    const validated = parseTaskMapDocument(document);
    if (inspectDocumentInvariants(validated).length > 0) {
      return invalidDocumentResult();
    }
    return { ok: true, value: JSON.stringify(validated) };
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
