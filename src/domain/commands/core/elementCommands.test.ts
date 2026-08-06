// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  COMMAND_TEST_IDS,
  createCommandTestDocument,
  executeTestCommand,
} from "../commandTestSupport";

describe("element commands", () => {
  it("inserts, updates geometry and data, and reorders one normalized element", () => {
    let document = createCommandTestDocument();
    document = succeed(document, "document.element.insert", {
      element: {
        id: COMMAND_TEST_IDS.elementC,
        canvasId: COMMAND_TEST_IDS.canvasA,
        type: "generic-note",
        geometry: { x: 1, y: 2, width: 30, height: 40 },
        data: { value: "new" },
      },
      index: 1,
    });
    expect(document.canvases[COMMAND_TEST_IDS.canvasA].elementOrder).toEqual([
      COMMAND_TEST_IDS.elementA,
      COMMAND_TEST_IDS.elementC,
      COMMAND_TEST_IDS.elementB,
    ]);

    document = succeed(document, "document.element.update-geometry", {
      elementId: COMMAND_TEST_IDS.elementC,
      geometry: { x: 50, y: 60, width: 70, height: 80 },
    });
    document = succeed(document, "document.element.replace-data", {
      elementId: COMMAND_TEST_IDS.elementC,
      data: { nested: { safe: true } },
    });
    document = succeed(document, "document.element.reorder", {
      elementId: COMMAND_TEST_IDS.elementC,
      toIndex: 0,
    });

    expect(document.elements[COMMAND_TEST_IDS.elementC]).toMatchObject({
      geometry: { x: 50, y: 60, width: 70, height: 80 },
      data: { nested: { safe: true } },
    });
    expect(document.canvases[COMMAND_TEST_IDS.canvasA].elementOrder).toEqual([
      COMMAND_TEST_IDS.elementC,
      COMMAND_TEST_IDS.elementA,
      COMMAND_TEST_IDS.elementB,
    ]);
  });

  it("removes dependent connections and element-targeted extensions atomically", () => {
    const document = createCommandTestDocument();
    const result = executeTestCommand(document, {
      type: "document.element.remove",
      payload: { elementId: COMMAND_TEST_IDS.elementA },
    });
    if (!result.ok) throw new Error("Expected removal");

    expect(result.document.elements[COMMAND_TEST_IDS.elementA]).toBeUndefined();
    expect(result.document.connections[COMMAND_TEST_IDS.connection]).toBeUndefined();
    expect(result.document.extensionInstallations[COMMAND_TEST_IDS.extensionA]).toBeUndefined();
    expect(result.document.canvases[COMMAND_TEST_IDS.canvasA].elementOrder).toEqual([
      COMMAND_TEST_IDS.elementB,
    ]);
    expect(result.transaction).not.toBeNull();
  });

  it("rejects duplicate IDs, missing canvases/elements, and invalid reorder indices", () => {
    const document = createCommandTestDocument();
    const commands = [
      {
        type: "document.element.insert",
        payload: { element: document.elements[COMMAND_TEST_IDS.elementA] },
      },
      {
        type: "document.element.insert",
        payload: {
          element: {
            id: COMMAND_TEST_IDS.elementC,
            canvasId: COMMAND_TEST_IDS.canvasB,
            type: "generic-note",
            geometry: { x: 0, y: 0, width: 1, height: 1 },
            data: {},
          },
        },
      },
      {
        type: "document.element.update-geometry",
        payload: {
          elementId: COMMAND_TEST_IDS.elementC,
          geometry: { x: 0, y: 0, width: 1, height: 1 },
        },
      },
      {
        type: "document.element.reorder",
        payload: { elementId: COMMAND_TEST_IDS.elementA, toIndex: 2 },
      },
    ];
    for (const command of commands) {
      const result = executeTestCommand(document, command);
      expect(result.ok).toBe(false);
      expect(result.document).toBe(document);
    }
  });

  it("creates one history transaction for one final geometry command", () => {
    const document = createCommandTestDocument();
    const result = executeTestCommand(document, {
      type: "document.element.update-geometry",
      payload: {
        elementId: COMMAND_TEST_IDS.elementA,
        geometry: { x: 101, y: 102, width: 240, height: 120 },
      },
    });
    expect(result.ok).toBe(true);
    expect(result.transaction?.patches.length).toBeGreaterThan(0);
    expect(result.transaction?.label).toBe("Update element geometry");
  });
});

function succeed(
  document: ReturnType<typeof createCommandTestDocument>,
  type: string,
  payload: unknown,
) {
  const result = executeTestCommand(document, { type, payload });
  if (!result.ok) throw new Error(result.issues.map((issue) => issue.message).join(", "));
  return result.document;
}
