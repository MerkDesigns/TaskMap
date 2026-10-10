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

// Deep-frozen documents that passed validation. Every command and save validates the whole
// document, and most of those calls see an object that was already checked: the store's current
// document, or a command result about to be saved. Command results come from immer, which
// deep-freezes them, so they cannot have changed since and are answered from here instead of
// re-parsing hundreds of elements. Unfrozen input is always validated in full.
const validatedDocuments = new WeakSet<object>();

const isDeepFrozen = (value: unknown): boolean =>
  value === null ||
  typeof value !== "object" ||
  (Object.isFrozen(value) && Object.values(value).every(isDeepFrozen));

export function validateTaskMapDocument(input: unknown): DocumentValidationResult {
  const cacheable = typeof input === "object" && input !== null;
  if (cacheable && validatedDocuments.has(input)) {
    return { ok: true, document: input as TaskMapDocument };
  }
  const result = validateUncached(input);
  // The schema has no transforms, so a valid input is exactly its parsed form.
  if (result.ok && cacheable && isDeepFrozen(input)) validatedDocuments.add(input);
  return result;
}

function validateUncached(input: unknown): DocumentValidationResult {
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
