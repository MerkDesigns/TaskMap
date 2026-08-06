// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  COMMAND_TEST_IDS,
  createCommandTestDocument,
  executeTestCommand,
} from "../commandTestSupport";

describe("canvas commands", () => {
  it("creates, renames, updates, activates, and reorders canvases", () => {
    let document = createCommandTestDocument();
    document = succeed(document, "document.canvas.create", {
      canvas: {
        id: COMMAND_TEST_IDS.canvasB,
        name: "Second",
        settings: { width: 1200, height: 900 },
      },
      index: 0,
    });
    expect(document.canvasOrder).toEqual([COMMAND_TEST_IDS.canvasB, COMMAND_TEST_IDS.canvasA]);
    expect(document.canvases[COMMAND_TEST_IDS.canvasB].elementOrder).toEqual([]);

    document = succeed(document, "document.canvas.rename", {
      canvasId: COMMAND_TEST_IDS.canvasB,
      name: "Renamed",
    });
    document = succeed(document, "document.canvas.update-settings", {
      canvasId: COMMAND_TEST_IDS.canvasB,
      settings: { width: 800, height: 600 },
    });
    const activation = executeTestCommand(document, {
      type: "document.canvas.set-active",
      payload: { canvasId: COMMAND_TEST_IDS.canvasB },
    });
    expect(activation.ok).toBe(true);
    expect(activation.transaction).toBeNull();
    document = activation.document;
    document = succeed(document, "document.canvas.reorder", {
      order: [COMMAND_TEST_IDS.canvasA, COMMAND_TEST_IDS.canvasB],
    });

    expect(document.activeCanvasId).toBe(COMMAND_TEST_IDS.canvasB);
    expect(document.canvases[COMMAND_TEST_IDS.canvasB]).toMatchObject({
      name: "Renamed",
      settings: { width: 800, height: 600 },
    });
    expect(document.canvasOrder).toEqual([COMMAND_TEST_IDS.canvasA, COMMAND_TEST_IDS.canvasB]);
  });

  it("rejects incomplete, duplicate, and out-of-range orders", () => {
    const initial = createCommandTestDocument();
    const withSecond = succeed(initial, "document.canvas.create", {
      canvas: {
        id: COMMAND_TEST_IDS.canvasB,
        name: "Second",
        settings: { width: 100, height: 100 },
      },
    });
    for (const order of [
      [COMMAND_TEST_IDS.canvasA],
      [COMMAND_TEST_IDS.canvasA, COMMAND_TEST_IDS.canvasA],
      [COMMAND_TEST_IDS.canvasA, COMMAND_TEST_IDS.canvasC],
    ]) {
      const result = executeTestCommand(withSecond, {
        type: "document.canvas.reorder",
        payload: { order },
      });
      expect(result.ok).toBe(false);
      expect(result.document).toBe(withSecond);
    }
  });

  it("removes a canvas with only its normalized dependents and selects a deterministic active canvas", () => {
    const initial = createCommandTestDocument();
    let document = succeed(initial, "document.canvas.create", {
      canvas: {
        id: COMMAND_TEST_IDS.canvasB,
        name: "Second",
        settings: { width: 100, height: 100 },
      },
    });
    document = succeed(document, "document.canvas.remove", {
      canvasId: COMMAND_TEST_IDS.canvasA,
    });

    expect(document.canvasOrder).toEqual([COMMAND_TEST_IDS.canvasB]);
    expect(document.activeCanvasId).toBe(COMMAND_TEST_IDS.canvasB);
    expect(document.elements).toEqual({});
    expect(document.connections).toEqual({});
    expect(document.extensionInstallations).toEqual({});
    expect(document.mediaReferences).toEqual(initial.mediaReferences);

    document = succeed(document, "document.canvas.remove", {
      canvasId: COMMAND_TEST_IDS.canvasB,
    });
    expect(document.canvasOrder).toEqual([]);
    expect(document.activeCanvasId).toBeNull();
  });

  it("rejects missing canvases without modifying the document", () => {
    const document = createCommandTestDocument();
    const result = executeTestCommand(document, {
      type: "document.canvas.remove",
      payload: { canvasId: COMMAND_TEST_IDS.canvasB },
    });
    expect(result.ok).toBe(false);
    expect(result.document).toBe(document);
  });
});

function succeed(
  document: ReturnType<typeof createCommandTestDocument>,
  type: string,
  payload: unknown,
) {
  const result = executeTestCommand(document, { type, payload });
  if (!result.ok) throw new Error(result.issues.map((issue) => issue.message).join(", "));
  expect(result.transaction).not.toBeNull();
  return result.document;
}
