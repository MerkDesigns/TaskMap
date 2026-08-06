// @vitest-environment node

import { describe, expect, it } from "vitest";
import { parseTaskMapDocument } from "./documentSchema";
import { createValidDocumentInput, TEST_IDS } from "./documentTestFixtures";
import { validateTaskMapDocument } from "./validateDocument";

function invariantCodes(input: unknown): readonly string[] {
  const result = validateTaskMapDocument(input);
  expect(result).toMatchObject({ ok: false, stage: "invariants" });
  return result.ok ? [] : result.issues.map((issue) => issue.code);
}

describe("current document semantic invariants", () => {
  it("accepts normalized elements and a same-canvas connection", () => {
    const result = validateTaskMapDocument(createValidDocumentInput());
    expect(result).toMatchObject({ ok: true });
  });

  it("preserves multiple canvases in explicit stable order", () => {
    const input = createValidDocumentInput();
    input.canvasOrder.push(TEST_IDS.canvasB);
    input.canvases[TEST_IDS.canvasB] = {
      id: TEST_IDS.canvasB,
      name: "Second canvas",
      settings: { width: 4_000, height: 2_000 },
      elementOrder: [],
    };

    const result = validateTaskMapDocument(input);
    expect(result).toMatchObject({ ok: true });
    if (result.ok)
      expect(result.document.canvasOrder).toEqual([TEST_IDS.canvasA, TEST_IDS.canvasB]);
  });

  it("rejects elements referencing a missing canvas", () => {
    const input = createValidDocumentInput();
    input.elements[TEST_IDS.elementA].canvasId = TEST_IDS.canvasB;
    expect(invariantCodes(input)).toEqual(
      expect.arrayContaining(["element-canvas-missing", "element-order-wrong-canvas"]),
    );
  });

  it("rejects connections referencing missing elements", () => {
    const input = createValidDocumentInput();
    delete input.elements[TEST_IDS.elementB];
    input.canvases[TEST_IDS.canvasA].elementOrder.pop();
    expect(invariantCodes(input)).toContain("connection-endpoint-missing");
  });

  it("rejects connections referencing a missing canvas", () => {
    const input = createValidDocumentInput();
    const connection = input.connections[TEST_IDS.connection];
    if (typeof connection === "object" && connection !== null) {
      Object.assign(connection, { canvasId: TEST_IDS.canvasB });
    }
    expect(invariantCodes(input)).toContain("connection-canvas-missing");
  });

  it("rejects cross-canvas connections", () => {
    const input = createValidDocumentInput();
    input.canvasOrder.push(TEST_IDS.canvasB);
    input.canvases[TEST_IDS.canvasB] = {
      id: TEST_IDS.canvasB,
      name: "Second canvas",
      settings: { width: 3_000, height: 3_000 },
      elementOrder: [TEST_IDS.elementB],
    };
    input.canvases[TEST_IDS.canvasA].elementOrder.pop();
    input.elements[TEST_IDS.elementB].canvasId = TEST_IDS.canvasB;

    expect(invariantCodes(input)).toContain("connection-cross-canvas");
  });

  it("rejects duplicate and missing canvas order references", () => {
    const input = createValidDocumentInput();
    input.canvasOrder = [TEST_IDS.canvasA, TEST_IDS.canvasA, TEST_IDS.canvasB];
    const codes = invariantCodes(input);
    expect(codes).toEqual(
      expect.arrayContaining(["canvas-order-duplicate", "canvas-order-reference-missing"]),
    );
  });

  it("rejects duplicate and missing element layer references", () => {
    const input = createValidDocumentInput();
    input.canvases[TEST_IDS.canvasA].elementOrder = [
      TEST_IDS.elementA,
      TEST_IDS.elementA,
      "element-00000000-0000-4000-8000-000000000099",
    ];
    const codes = invariantCodes(input);
    expect(codes).toEqual(
      expect.arrayContaining([
        "element-order-duplicate",
        "element-order-reference-missing",
        "element-order-missing",
      ]),
    );
  });

  it("requires exactly one valid active canvas whenever canvases exist", () => {
    const missing = createValidDocumentInput();
    missing.activeCanvasId = TEST_IDS.canvasB;
    expect(invariantCodes(missing)).toContain("active-canvas-missing");

    const absent = createValidDocumentInput();
    absent.activeCanvasId = null;
    expect(invariantCodes(absent)).toContain("active-canvas-required");

    const empty = createValidDocumentInput();
    empty.activeCanvasId = null;
    empty.canvasOrder = [];
    empty.canvases = {};
    empty.elements = {};
    empty.connections = {};
    empty.extensionInstallations = {};
    expect(validateTaskMapDocument(empty)).toMatchObject({ ok: true });
  });

  it("rejects inconsistent normalized keys and duplicate entity IDs", () => {
    const input = createValidDocumentInput();
    input.elements["element-00000000-0000-4000-8000-000000000099"] = {
      ...input.elements[TEST_IDS.elementA],
    };
    const codes = invariantCodes(input);
    expect(codes).toEqual(expect.arrayContaining(["entity-key-mismatch", "entity-id-duplicate"]));
  });

  it("keeps generic extension records reference-safe without module-specific branches", () => {
    const input = createValidDocumentInput();
    input.extensionInstallations[TEST_IDS.extensionB] = {
      id: TEST_IDS.extensionB,
      extensionId: "checkbox",
      target: {
        kind: "element",
        elementId: "element-00000000-0000-4000-8000-000000000099",
      },
      enabled: false,
      configuration: {},
    };
    expect(invariantCodes(input)).toContain("extension-target-missing");
  });

  it("rejects duplicate extension installations on one target", () => {
    const input = createValidDocumentInput();
    input.extensionInstallations[TEST_IDS.extensionB] = {
      ...input.extensionInstallations[TEST_IDS.extensionA],
      id: TEST_IDS.extensionB,
    };
    expect(invariantCodes(input)).toContain("extension-installation-duplicate");
  });

  it("keeps structural parsing separate from semantic validation", () => {
    const input = createValidDocumentInput();
    input.activeCanvasId = TEST_IDS.canvasB;
    expect(() => parseTaskMapDocument(input)).not.toThrow();
    expect(validateTaskMapDocument(input)).toMatchObject({ ok: false, stage: "invariants" });
  });
});
