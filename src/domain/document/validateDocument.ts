import {
  DocumentStructureError,
  parseTaskMapDocument,
  type DocumentStructureIssue,
} from "./documentSchema";
import { inspectDocumentInvariants, type DocumentInvariantIssue } from "./documentInvariants";
import type { TaskMapDocument } from "./documentTypes";

export type DocumentValidationResult =
  | { readonly ok: true; readonly document: TaskMapDocument }
  | {
      readonly ok: false;
      readonly stage: "structure";
      readonly issues: readonly DocumentStructureIssue[];
    }
  | {
      readonly ok: false;
      readonly stage: "invariants";
      readonly issues: readonly DocumentInvariantIssue[];
    };

export function validateTaskMapDocument(input: unknown): DocumentValidationResult {
  let document: TaskMapDocument;
  try {
    document = parseTaskMapDocument(input);
  } catch (error: unknown) {
    if (error instanceof DocumentStructureError) {
      return { ok: false, stage: "structure", issues: error.issues };
    }
    throw error;
  }

  const issues = inspectDocumentInvariants(document);
  return issues.length === 0 ? { ok: true, document } : { ok: false, stage: "invariants", issues };
}
