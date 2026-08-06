// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  COMMAND_TEST_IDS,
  createCommandTestDocument,
  executeTestCommand,
} from "../commands/commandTestSupport";
import { asEntityId } from "../ids/entityIds";
import {
  clearHistory,
  createEmptyHistory,
  recordTransaction,
  redoDocument,
  undoDocument,
} from "./historyEngine";
import type { HistoryState } from "./historyTypes";

describe("Immer patch history", () => {
  it("records, undoes, and redoes one transaction", () => {
    const initial = createCommandTestDocument();
    const command = executeTestCommand(initial, rename("First change"));
    if (!command.ok || command.transaction === null) throw new Error("Expected transaction");
    const history = recordTransaction(createEmptyHistory(), command.transaction);
    expect(history.past).toHaveLength(1);
    expect(history.future).toHaveLength(0);

    const undone = undoDocument(command.document, history);
    expect(undone.ok).toBe(true);
    if (!undone.ok) throw new Error("Expected undo");
    expect(undone.document).toEqual(initial);
    expect(undone.history.past).toHaveLength(0);
    expect(undone.history.future).toHaveLength(1);

    const redone = redoDocument(undone.document, undone.history);
    expect(redone.ok).toBe(true);
    if (!redone.ok) throw new Error("Expected redo");
    expect(redone.document).toEqual(command.document);
    expect(redone.history.past).toHaveLength(1);
    expect(redone.history.future).toHaveLength(0);
  });

  it("preserves multiple-step undo and redo order", () => {
    let document = createCommandTestDocument();
    let history = createEmptyHistory();
    for (const name of ["One", "Two", "Three"]) {
      ({ document, history } = commit(document, history, rename(name)));
    }
    for (const expected of ["Two", "One", "First canvas"]) {
      const result = undoDocument(document, history);
      if (!result.ok) throw new Error("Expected undo");
      document = result.document;
      history = result.history;
      expect(document.canvases[COMMAND_TEST_IDS.canvasA].name).toBe(expected);
    }
    for (const expected of ["One", "Two", "Three"]) {
      const result = redoDocument(document, history);
      if (!result.ok) throw new Error("Expected redo");
      document = result.document;
      history = result.history;
      expect(document.canvases[COMMAND_TEST_IDS.canvasA].name).toBe(expected);
    }
  });

  it("invalidates redo only after a newly recorded command", () => {
    const initial = createCommandTestDocument();
    const first = commit(initial, createEmptyHistory(), rename("One"));
    const second = commit(first.document, first.history, rename("Two"));
    const undone = undoDocument(second.document, second.history);
    if (!undone.ok) throw new Error("Expected undo");
    expect(undone.history.future).toHaveLength(1);

    const noOp = executeTestCommand(undone.document, rename("One"));
    expect(noOp.transaction).toBeNull();
    expect(undone.history.future).toHaveLength(1);

    const branched = commit(undone.document, undone.history, rename("Branch"));
    expect(branched.history.future).toHaveLength(0);
    expect(branched.history.past).toHaveLength(2);
  });

  it("keeps ignored commands out of history and preserves their unrelated fields on undo", () => {
    const input = createCommandTestDocument();
    const created = executeTestCommand(input, {
      type: "document.canvas.create",
      payload: {
        canvas: {
          id: COMMAND_TEST_IDS.canvasB,
          name: "Second",
          settings: { width: 100, height: 100 },
        },
      },
    });
    if (!created.ok) throw new Error("Expected create");
    const baseline = created.document;
    const active = executeTestCommand(baseline, {
      type: "document.canvas.set-active",
      payload: { canvasId: COMMAND_TEST_IDS.canvasB },
    });
    expect(active.transaction).toBeNull();
    const renamed = executeTestCommand(active.document, rename("Changed"));
    if (!renamed.ok || renamed.transaction === null) throw new Error("Expected rename");
    const history = recordTransaction(createEmptyHistory(), renamed.transaction);
    const undone = undoDocument(renamed.document, history);
    if (!undone.ok) throw new Error("Expected undo");

    expect(history.past).toHaveLength(1);
    expect(undone.document.activeCanvasId).toBe(COMMAND_TEST_IDS.canvasB);
    expect(undone.document.canvases[COMMAND_TEST_IDS.canvasA].name).toBe("First canvas");

    const redone = redoDocument(undone.document, undone.history);
    if (!redone.ok) throw new Error("Expected redo");
    expect(redone.document.activeCanvasId).toBe(COMMAND_TEST_IDS.canvasB);
    expect(redone.document.canvases[COMMAND_TEST_IDS.canvasA].name).toBe("Changed");
  });

  it("fails closed for corrupt or incompatible patches", () => {
    const document = createCommandTestDocument();
    const corruptHistory: HistoryState = {
      past: [
        {
          id: asEntityId("transaction", COMMAND_TEST_IDS.transaction),
          label: "Corrupt",
          committedAt: 1,
          patches: [{ op: "replace", path: ["missing", "path"], value: true }],
          inversePatches: [{ op: "remove", path: ["canvases", COMMAND_TEST_IDS.canvasA] }],
        },
      ],
      future: [],
    };
    const result = undoDocument(document, corruptHistory);
    expect(result.ok).toBe(false);
    expect(result.document).toBe(document);
    expect(result.history).toBe(corruptHistory);
    expect(result.ok ? [] : result.issues).toContainEqual(
      expect.objectContaining({ code: "history-document-invalid", operation: "undo" }),
    );

    const corruptRedo: HistoryState = {
      past: [],
      future: [
        {
          ...corruptHistory.past[0],
          patches: [{ op: "replace", path: ["missing", "path"], value: true }],
        },
      ],
    };
    const redo = redoDocument(document, corruptRedo);
    expect(redo.ok).toBe(false);
    expect(redo.document).toBe(document);
    expect(redo.history).toBe(corruptRedo);
    expect(redo.ok ? [] : redo.issues).toContainEqual(
      expect.objectContaining({ code: "history-patch-failed", operation: "redo" }),
    );
  });

  it("supports explicit capacity and clear policies without a hard-coded limit", () => {
    let document = createCommandTestDocument();
    let history = createEmptyHistory();
    for (const name of ["One", "Two", "Three"]) {
      const result = executeTestCommand(document, rename(name));
      if (!result.ok || result.transaction === null) throw new Error("Expected transaction");
      document = result.document;
      history = recordTransaction(history, result.transaction, { maximumEntries: 2 });
    }
    expect(history.past.map((entry) => entry.label)).toHaveLength(2);
    expect(clearHistory()).toEqual({ past: [], future: [] });
    expect(() => recordTransaction(history, history.past[0], { maximumEntries: 0 })).toThrow();
  });
});

function rename(name: string) {
  return {
    type: "document.canvas.rename",
    payload: { canvasId: COMMAND_TEST_IDS.canvasA, name },
  };
}

function commit(
  document: ReturnType<typeof createCommandTestDocument>,
  history: HistoryState,
  command: unknown,
) {
  const result = executeTestCommand(document, command);
  if (!result.ok || result.transaction === null) throw new Error("Expected transaction");
  return { document: result.document, history: recordTransaction(history, result.transaction) };
}
