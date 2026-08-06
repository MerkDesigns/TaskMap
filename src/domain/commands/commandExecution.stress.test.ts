// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { parseTaskMapDocument } from "../document/documentSchema";
import { createValidDocumentInput } from "../document/documentTestFixtures";
import { COMMAND_TEST_IDS, executeTestCommand } from "./commandTestSupport";

describe("large document command boundary", () => {
  it("updates one of 10,000 elements without JSON serialization or snapshot patches", () => {
    const input = createValidDocumentInput();
    input.connections = {};
    input.extensionInstallations = {};
    input.mediaReferences = {};
    const order = input.canvases[COMMAND_TEST_IDS.canvasA].elementOrder;
    for (let index = 2; index < 10_000; index += 1) {
      const suffix = (index + 256).toString(16).padStart(12, "0");
      const id = `element-00000000-0000-4000-8000-${suffix}`;
      order.push(id);
      input.elements[id] = {
        id,
        canvasId: COMMAND_TEST_IDS.canvasA,
        type: "stress-node",
        geometry: { x: index, y: index, width: 20, height: 20 },
        data: { index },
      };
    }
    const document = parseTaskMapDocument(input);
    const stringify = vi.spyOn(JSON, "stringify");
    const result = executeTestCommand(document, {
      type: "document.element.update-geometry",
      payload: {
        elementId: COMMAND_TEST_IDS.elementA,
        geometry: { x: 999, y: 998, width: 240, height: 120 },
      },
    });

    expect(result.ok).toBe(true);
    expect(stringify).not.toHaveBeenCalled();
    expect(Object.keys(result.document.elements)).toHaveLength(10_000);
    expect(result.transaction?.patches.every((patch) => patch.path[0] === "elements")).toBe(true);
    expect(result.transaction?.patches.every((patch) => patch.path.length > 2)).toBe(true);
    stringify.mockRestore();
  });
});
