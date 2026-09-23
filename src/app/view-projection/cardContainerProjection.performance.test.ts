// @vitest-environment node
import { produce } from "immer";
import { describe, expect, it, vi } from "vitest";
import { createViewport } from "../../canvas/geometry/viewportMath";
import { textCardElementSchema } from "../../elements/text-card/textCardModel";
import { containerElementSchema } from "../../elements/container/containerModel";
import { createCanvasInteractionController } from "../interactions/canvasInteractionController";
import { createRetainedCanvasProjection } from "./createRetainedCanvasProjection";
import {
  createCardContainerInput,
  TEST_IDS,
  validated,
} from "../../elements/cardContainerTestFixtures";
import type { RetainedCanvasProjectionResult } from "./retainedCanvasProjectionTypes";

function firstCanvas(result: RetainedCanvasProjectionResult) {
  if (!result.ok) throw new Error("Expected projection");
  return result.canvases[0];
}

describe("card/container projection lifetime and interaction cost", () => {
  it("reuses the identical result through 100 actual pan/zoom controller samples without parsing or serialization", () => {
    const document = validated(createCardContainerInput());
    const selector = createRetainedCanvasProjection();
    const first = selector.project(document);
    const commitMove = vi.fn();
    const controller = createCanvasInteractionController({
      canvasKey: TEST_IDS.canvasA,
      viewport: createViewport({ x: 0, y: 0 }, 1, { width: 1000, height: 800 }),
      commitPort: { commitMove, commitResize: vi.fn(), commitLayerOrder: vi.fn() },
    });
    const cardParse = vi.spyOn(textCardElementSchema, "parse");
    const containerParse = vi.spyOn(containerElementSchema, "parse");
    const stringify = vi.spyOn(JSON, "stringify");
    try {
      controller.beginPan(1, { x: 0, y: 0 });
      for (let frame = 1; frame <= 100; frame++) {
        controller.updatePointer({ pointerId: 1, screen: { x: frame, y: frame }, snapping: false });
        expect(selector.project(document)).toBe(first);
      }
      controller.completePointer({ pointerId: 1, screen: { x: 100, y: 100 }, snapping: false });
      for (let frame = 1; frame <= 100; frame++) {
        controller.wheelZoom({ x: 500, y: 400 }, -1);
        expect(selector.project(document)).toBe(first);
      }
      expect(cardParse).not.toHaveBeenCalled();
      expect(containerParse).not.toHaveBeenCalled();
      expect(stringify).not.toHaveBeenCalled();
      expect(commitMove).not.toHaveBeenCalled();
    } finally {
      vi.restoreAllMocks();
      controller.dispose();
      selector.clear();
    }
  });

  it("reprojects only a changed entity while retaining other view identities", () => {
    const document = validated(createCardContainerInput());
    const selector = createRetainedCanvasProjection();
    const before = firstCanvas(selector.project(document));
    const afterDocument = produce(document, (draft) => {
      draft.elements[TEST_IDS.elementB].geometry.x += 50;
    });
    const cardParse = vi.spyOn(textCardElementSchema, "parse");
    const containerParse = vi.spyOn(containerElementSchema, "parse");
    try {
      const after = firstCanvas(selector.project(afterDocument));
      expect(after.containers[0]).toBe(before.containers[0]);
      expect(after.textCards[0]).not.toBe(before.textCards[0]);
      expect(after.textCards[0].x).toBe(350);
      expect(after.textCards[0]).not.toHaveProperty("width");
      expect(cardParse).toHaveBeenCalledTimes(1);
      expect(containerParse).not.toHaveBeenCalled();
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("invalidates derived layers when only elementOrder changes", () => {
    const document = validated(createCardContainerInput());
    const selector = createRetainedCanvasProjection();
    const before = firstCanvas(selector.project(document));
    const afterDocument = produce(document, (draft) => {
      draft.canvases[TEST_IDS.canvasA].elementOrder.reverse();
    });
    expect(afterDocument.elements).toBe(document.elements);
    const after = firstCanvas(selector.project(afterDocument));
    expect(after.textCards[0].layer).toBe(0);
    expect(after.containers[0].layer).toBe(1);
    expect(before.textCards[0].layer).toBe(1);
    expect(after.textCards[0].order).toBe(3);
  });

  it("rechecks cached children's relationships when a parent changes or disappears", () => {
    const document = validated(createCardContainerInput());
    const selector = createRetainedCanvasProjection();
    expect(selector.project(document).ok).toBe(true);
    const changed = {
      ...document,
      elements: {
        ...document.elements,
        [TEST_IDS.elementA]: {
          ...document.elements[TEST_IDS.elementA],
          type: "text-card",
          data: { text: "Root", accent: "red", link: null, placement: null },
        },
      },
    };
    expect(selector.project(changed)).toEqual({
      ok: false,
      issues: [{ code: "invalid-container-parent", elementId: TEST_IDS.elementB }],
    });
    expect(selector.project(document).ok).toBe(true);
  });

  it("clears all owned memoized plaintext references and does not reuse entries after clear", () => {
    const document = validated(createCardContainerInput());
    const selector = createRetainedCanvasProjection();
    const before = selector.project(document);
    selector.clear();
    const after = selector.project(document);
    expect(after).not.toBe(before);
    expect(firstCanvas(after).textCards[0]).not.toBe(firstCanvas(before).textCards[0]);
    expect(after).toEqual(before);
    selector.clear();
    selector.clear();
  });

  it("does not confuse identical IDs in a replacement document with the previous content", () => {
    const selector = createRetainedCanvasProjection();
    const before = firstCanvas(selector.project(validated(createCardContainerInput())));
    const replacement = createCardContainerInput();
    replacement.elements[TEST_IDS.elementB].data.text = "Replacement";
    const after = firstCanvas(selector.project(validated(replacement)));
    expect(after.textCards[0].text).toBe("Replacement");
    expect(after.textCards[0]).not.toBe(before.textCards[0]);
  });
});
