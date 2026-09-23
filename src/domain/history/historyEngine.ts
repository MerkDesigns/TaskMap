import { applyPatches, type Patch } from "immer";
import { areJsonValuesDeepEqual } from "../document/jsonDeepEqual";
import type { TaskMapDocument } from "../document/documentTypes";
import { validateTaskMapDocument } from "../document/validateDocument";
import { ensureImmerPatchSupport } from "./immerPatchSupport";
import type { HistoryCapacity, HistoryIssue, HistoryState } from "./historyTypes";
import type { DomainTransaction } from "./transactionTypes";

export type HistoryOperationResult =
  | {
      readonly ok: true;
      readonly changed: boolean;
      readonly document: TaskMapDocument;
      readonly history: HistoryState;
    }
  | {
      readonly ok: false;
      readonly document: TaskMapDocument;
      readonly history: HistoryState;
      readonly issues: readonly HistoryIssue[];
    };

export function createEmptyHistory(): HistoryState {
  return { past: [], future: [] };
}

export function recordTransaction(
  history: HistoryState,
  transaction: DomainTransaction,
  capacity: HistoryCapacity = {},
): HistoryState {
  const maximum = capacity.maximumEntries;
  if (maximum !== undefined && (!Number.isInteger(maximum) || maximum < 1)) {
    throw new Error("History capacity must be a positive integer");
  }
  const past = [...history.past, transaction];
  return {
    past: maximum === undefined ? past : past.slice(-maximum),
    future: [],
  };
}

export function undoDocument(
  document: TaskMapDocument,
  history: HistoryState,
): HistoryOperationResult {
  const entry = history.past[history.past.length - 1];
  if (entry === undefined) return unchanged(document, history);
  const nextHistory: HistoryState = {
    past: history.past.slice(0, -1),
    future: [entry, ...history.future],
  };
  return applyHistoryTransaction("undo", document, history, nextHistory, entry);
}

export function redoDocument(
  document: TaskMapDocument,
  history: HistoryState,
): HistoryOperationResult {
  const entry = history.future[0];
  if (entry === undefined) return unchanged(document, history);
  const nextHistory: HistoryState = {
    past: [...history.past, entry],
    future: history.future.slice(1),
  };
  return applyHistoryTransaction("redo", document, history, nextHistory, entry);
}

export function clearHistory(): HistoryState {
  return createEmptyHistory();
}

function applyHistoryTransaction(
  operation: "undo" | "redo",
  document: TaskMapDocument,
  history: HistoryState,
  nextHistory: HistoryState,
  transaction: DomainTransaction,
): HistoryOperationResult {
  ensureImmerPatchSupport();
  if (transaction.patches.length === 0 || transaction.inversePatches.length === 0) {
    return failed(document, history, operation, "history-transaction-incompatible");
  }
  const patches = operation === "undo" ? transaction.inversePatches : transaction.patches;
  const reversePatches = operation === "undo" ? transaction.patches : transaction.inversePatches;
  let candidate: TaskMapDocument;
  try {
    candidate = applyPatches(document, patches);
    candidate = reconcileCanvasSelection(document, candidate, reversePatches);
  } catch {
    return failed(document, history, operation, "history-patch-failed");
  }
  const validation = validateTaskMapDocument(candidate);
  if (!validation.ok) {
    return failed(document, history, operation, "history-document-invalid");
  }
  let roundTrip: TaskMapDocument;
  try {
    roundTrip = applyPatches(candidate, reversePatches);
  } catch {
    return failed(document, history, operation, "history-transaction-incompatible");
  }
  // Canvas navigation is a non-history command. Compare every persistent content field while
  // allowing selection to have changed since the transaction (including a now-removed canvas).
  if (roundTrip.activeCanvasId !== null && !roundTrip.canvases[roundTrip.activeCanvasId])
    return failed(document, history, operation, "history-transaction-incompatible");
  roundTrip = { ...roundTrip, activeCanvasId: document.activeCanvasId };
  if (!validateTaskMapDocument(roundTrip).ok || !areJsonValuesDeepEqual(roundTrip, document)) {
    return failed(document, history, operation, "history-transaction-incompatible");
  }
  return { ok: true, changed: true, document: candidate, history: nextHistory };
}

function reconcileCanvasSelection(
  before: TaskMapDocument,
  candidate: TaskMapDocument,
  reversePatches: readonly Patch[],
): TaskMapDocument {
  const recordedSelection = reversePatches.find(
    ({ path }) => path.length === 1 && path[0] === "activeCanvasId",
  );
  const navigated =
    recordedSelection &&
    "value" in recordedSelection &&
    recordedSelection.value !== before.activeCanvasId;
  let activeCanvasId = navigated ? before.activeCanvasId : candidate.activeCanvasId;
  if (
    activeCanvasId !== null &&
    before.canvases[activeCanvasId] &&
    !candidate.canvases[activeCanvasId]
  )
    activeCanvasId = candidate.canvasOrder[0] ?? null;
  return activeCanvasId === candidate.activeCanvasId ? candidate : { ...candidate, activeCanvasId };
}

function unchanged(document: TaskMapDocument, history: HistoryState): HistoryOperationResult {
  return { ok: true, changed: false, document, history };
}

function failed(
  document: TaskMapDocument,
  history: HistoryState,
  operation: "undo" | "redo",
  code: HistoryIssue["code"],
): HistoryOperationResult {
  return {
    ok: false,
    document,
    history,
    issues: [
      {
        code,
        operation,
        message: `Unable to ${operation}; the current document and history were preserved`,
      },
    ],
  };
}
