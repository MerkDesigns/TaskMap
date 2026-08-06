// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  COMMAND_TEST_IDS,
  createCommandTestDocument,
  executeTestCommand,
} from "../commands/commandTestSupport";
import { createEmptyHistory, recordTransaction, redoDocument, undoDocument } from "./historyEngine";
import type { HistoryState } from "./historyTypes";
import type { DomainTransaction } from "./transactionTypes";

describe("history transaction compatibility", () => {
  it("fails closed on a structurally valid but mismatched current document", () => {
    const initial = createCommandTestDocument();
    const recorded = executeRename(initial, "Recorded change");
    const mismatchedCurrent = executeRename(initial, "Different valid change").document;
    const history = recordTransaction(createEmptyHistory(), recorded.transaction);

    const result = undoDocument(mismatchedCurrent, history);

    expectIncompatibleFailure(result, mismatchedCurrent, history, "undo");
  });

  it("fails closed when forward and inverse patches are mismatched", () => {
    const initial = createCommandTestDocument();
    const recorded = executeRename(initial, "Recorded change");
    const other = executeRename(initial, "Other change");
    const mismatched: DomainTransaction = {
      ...recorded.transaction,
      patches: other.transaction.patches,
    };
    const history: HistoryState = { past: [mismatched], future: [] };

    const result = undoDocument(recorded.document, history);

    expectIncompatibleFailure(result, recorded.document, history, "undo");
  });

  it("fails closed when either patch direction is empty", () => {
    const initial = createCommandTestDocument();
    const recorded = executeRename(initial, "Recorded change");
    const emptyForward: DomainTransaction = { ...recorded.transaction, patches: [] };
    const undoHistory: HistoryState = { past: [emptyForward], future: [] };
    const undo = undoDocument(recorded.document, undoHistory);
    expectIncompatibleFailure(undo, recorded.document, undoHistory, "undo");

    const emptyInverse: DomainTransaction = { ...recorded.transaction, inversePatches: [] };
    const redoHistory: HistoryState = { past: [], future: [emptyInverse] };
    const redo = redoDocument(initial, redoHistory);
    expectIncompatibleFailure(redo, initial, redoHistory, "redo");
  });

  it("performs compatible undo and redo without serialization", () => {
    const initial = createCommandTestDocument();
    const recorded = executeRename(initial, "Recorded change");
    const history = recordTransaction(createEmptyHistory(), recorded.transaction);
    const stringify = vi.spyOn(JSON, "stringify");

    const undone = undoDocument(recorded.document, history);
    expect(undone.ok).toBe(true);
    if (!undone.ok) throw new Error("Expected undo");
    const redone = redoDocument(undone.document, undone.history);
    expect(redone.ok).toBe(true);
    expect(stringify).not.toHaveBeenCalled();
    stringify.mockRestore();
  });
});

function executeRename(document: ReturnType<typeof createCommandTestDocument>, name: string) {
  const result = executeTestCommand(document, {
    type: "document.canvas.rename",
    payload: { canvasId: COMMAND_TEST_IDS.canvasA, name },
  });
  if (!result.ok || result.transaction === null) throw new Error("Expected rename transaction");
  return { document: result.document, transaction: result.transaction };
}

function expectIncompatibleFailure(
  result: ReturnType<typeof undoDocument>,
  document: ReturnType<typeof createCommandTestDocument>,
  history: HistoryState,
  operation: "undo" | "redo",
) {
  expect(result.ok).toBe(false);
  expect(result.document).toBe(document);
  expect(result.history).toBe(history);
  expect(result.ok ? [] : result.issues).toContainEqual(
    expect.objectContaining({ code: "history-transaction-incompatible", operation }),
  );
}
