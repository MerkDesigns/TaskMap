// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createRetainedCanvasProjection } from "./createRetainedCanvasProjection";
import {
  createCardContainerInput,
  TEST_IDS,
  validated,
} from "../../elements/cardContainerTestFixtures";

describe("unmounted card/container projection", () => {
  it("preserves presentation fields, canonical layers and child order without forced card sizes", () => {
    const document = validated(createCardContainerInput());
    const original = structuredClone(document);
    const result = createRetainedCanvasProjection().project(document);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected projection");
    expect(result.canvases[0]).toEqual({
      id: TEST_IDS.canvasA,
      name: "First canvas",
      width: 3000,
      height: 3000,
      images: [],
      textBlocks: [],
      mindmapConnections: [],
      containers: [
        {
          id: TEST_IDS.elementA,
          layer: 0,
          name: "Ideas 🗂️",
          accent: "#123456",
          headerButtonsVisible: false,
          x: 10,
          y: 20,
          width: 240,
          height: 120,
        },
      ],
      textCards: [
        {
          id: TEST_IDS.elementB,
          layer: 1,
          text: "First line\n第二行",
          accent: "#fedcba",
          x: 300,
          y: 20,
          containerId: TEST_IDS.elementA,
          order: 3,
        },
      ],
    });
    expect(document).toEqual(original);
    expect(Object.isFrozen(result.canvases[0].textCards[0])).toBe(true);
    expect(Object.isFrozen(result.canvases[0].containers[0])).toBe(true);
    expect(Object.isFrozen(result.canvases[0].textCards)).toBe(true);
    expect(Object.isFrozen(result.canvases)).toBe(true);
    expect(result.canvases[0]).not.toHaveProperty("pan");
    expect(result.canvases[0]).not.toHaveProperty("zoom");
  });

  it("preserves an empty link and text without defaulting or trimming, and omits root placement", () => {
    const input = createCardContainerInput();
    Object.assign(input.elements[TEST_IDS.elementB].data, { link: "", text: "", placement: null });
    const result = createRetainedCanvasProjection().project(validated(input));
    if (!result.ok) throw new Error("Expected projection");
    expect(result.canvases[0].textCards[0]).toMatchObject({ link: "", text: "" });
    expect(result.canvases[0].textCards[0]).not.toHaveProperty("containerId");
    expect(result.canvases[0].textCards[0]).not.toHaveProperty("order");
  });

  it.each([
    ["missing fields", {}],
    ["legacy fields", { text: "secret", accent: "red", link: null, placement: null, layer: 2 }],
    [
      "raw workflows",
      {
        text: "secret",
        accent: "red",
        link: null,
        placement: null,
        extensions: { commandRunner: { commands: [{ command: "secret shell" }] } },
      },
    ],
    [
      "missing placement order",
      { text: "secret", accent: "red", link: null, placement: { containerId: TEST_IDS.elementA } },
    ],
    [
      "negative order",
      {
        text: "secret",
        accent: "red",
        link: null,
        placement: { containerId: TEST_IDS.elementA, order: -1 },
      },
    ],
    [
      "fractional order",
      {
        text: "secret",
        accent: "red",
        link: null,
        placement: { containerId: TEST_IDS.elementA, order: 0.5 },
      },
    ],
    [
      "invalid parent ID",
      {
        text: "secret",
        accent: "red",
        link: null,
        placement: { containerId: "legacy-id", order: 0 },
      },
    ],
    [
      "nested extra fields",
      {
        text: "secret",
        accent: "red",
        link: null,
        placement: { containerId: TEST_IDS.elementA, order: 0, hidden: true },
      },
    ],
  ])("fails closed with sanitized issues for %s", (_name, data) => {
    const input = createCardContainerInput();
    input.elements[TEST_IDS.elementB].data = data;
    expect(createRetainedCanvasProjection().project(validated(input))).toEqual({
      ok: false,
      issues: [{ code: "invalid-element-data", elementId: TEST_IDS.elementB }],
    });
  });

  it.each(["missing", "self", "different canvas"])("rejects %s parent", (kind) => {
    const input = createCardContainerInput();
    const parentId = kind === "self" ? TEST_IDS.elementB : TEST_IDS.elementA;
    input.elements[TEST_IDS.elementB].data.placement = { containerId: parentId, order: 0 };
    if (kind === "missing") {
      delete input.elements[TEST_IDS.elementA];
      input.canvases[TEST_IDS.canvasA].elementOrder = [TEST_IDS.elementB];
    } else if (kind === "different canvas") {
      input.canvasOrder.push(TEST_IDS.canvasB);
      input.canvases[TEST_IDS.canvasB] = {
        id: TEST_IDS.canvasB,
        name: "Other",
        settings: { width: 3000, height: 3000 },
        elementOrder: [TEST_IDS.elementA],
      };
      input.elements[TEST_IDS.elementA].canvasId = TEST_IDS.canvasB;
      input.canvases[TEST_IDS.canvasA].elementOrder = [TEST_IDS.elementB];
    }
    expect(createRetainedCanvasProjection().project(validated(input))).toEqual({
      ok: false,
      issues: [{ code: "invalid-container-parent", elementId: TEST_IDS.elementB }],
    });
  });

  it("rejects duplicate child order without confusing it with canvas layer order", () => {
    const input = createCardContainerInput();
    const id = "element-00000000-0000-4000-8000-000000000099";
    input.elements[id] = { ...input.elements[TEST_IDS.elementB], id };
    input.canvases[TEST_IDS.canvasA].elementOrder.push(id);
    const projection = createRetainedCanvasProjection();
    expect(projection.project(validated(input))).toEqual({
      ok: false,
      issues: [{ code: "duplicate-child-order", elementId: id }],
    });
    input.elements[id].data = {
      ...input.elements[id].data,
      placement: { containerId: TEST_IDS.elementA, order: 1 },
    };
    expect(projection.project(validated(input)).ok).toBe(true);
  });

  it("does not expose a partial view when content elsewhere in the document is unsupported", () => {
    const input = createCardContainerInput();
    input.canvasOrder.push(TEST_IDS.canvasB);
    input.canvases[TEST_IDS.canvasB] = {
      id: TEST_IDS.canvasB,
      name: "Inactive",
      settings: { width: 3000, height: 3000 },
      elementOrder: [TEST_IDS.elementB],
    };
    input.canvases[TEST_IDS.canvasA].elementOrder = [TEST_IDS.elementA];
    input.elements[TEST_IDS.elementB].canvasId = TEST_IDS.canvasB;
    input.elements[TEST_IDS.elementB].type = "unknown-secret-type";
    expect(createRetainedCanvasProjection().project(validated(input))).toEqual({
      ok: false,
      issues: [{ code: "unsupported-element", elementId: TEST_IDS.elementB }],
    });
  });

  it.each(["extensionInstallations"] as const)(
    "fails closed for unsupported %s, including disabled extensions",
    async (field) => {
      const { createValidDocumentInput } =
        await import("../../domain/document/documentTestFixtures");
      const input = createCardContainerInput();
      Object.assign(input, { [field]: createValidDocumentInput()[field] });
      if (field === "extensionInstallations")
        input.extensionInstallations[TEST_IDS.extensionA].enabled = false;
      expect(createRetainedCanvasProjection().project(validated(input))).toEqual({
        ok: false,
        issues: [
          { code: "incompatible-extension-target", extensionInstanceId: TEST_IDS.extensionA },
        ],
      });
    },
  );
});
