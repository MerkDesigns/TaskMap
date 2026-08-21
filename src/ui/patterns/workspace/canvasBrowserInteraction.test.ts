// @vitest-environment node
import { describe, expect, expectTypeOf, it } from "vitest";
import type { CanvasId } from "../../../domain/ids/entityIds";
import type { CanvasBrowserRuntime } from "./CanvasBrowserRuntime";
import {
  CANVAS_CARD_AUTO_SCROLL,
  CANVAS_CARD_DRAG_THRESHOLD,
  CANVAS_CARD_SLOT_TRANSITION_MS,
  calculateCanvasCardAutoScroll,
  calculateCanvasCardAutoScrollOutsideExtension,
  calculateCanvasCardInsertionIndex,
  easeOutQuart,
  reorderCanvasCardToIndex,
} from "./canvasBrowserInteraction";

const ids = ["a", "b", "c", "d", "e", "f"] as const;

describe("Canvas Browser Renderer V2 interaction math", () => {
  it("keeps the finalized activation and animation constants", () => {
    expect(CANVAS_CARD_DRAG_THRESHOLD).toBe(6);
    expect(CANVAS_CARD_SLOT_TRANSITION_MS).toBe(190);
    expect(easeOutQuart(0.5)).toBe(0.9375);
  });

  it("supports absolute multi-slot insertion and scrolling list space", () => {
    expect(calculateCanvasCardInsertionIndex(ids, "b", 600, 74, 0, 94)).toBe(5);
    expect(reorderCanvasCardToIndex(ids, "b", 5)).toEqual(["a", "c", "d", "e", "f", "b"]);
    expect(calculateCanvasCardInsertionIndex(ids, "c", 300, 74, 120, 94)).toBe(3);
  });

  it("uses the finalized extended smooth auto-scroll zone", () => {
    expect(CANVAS_CARD_AUTO_SCROLL).toEqual({
      startInset: 52,
      outsideExtensionRatio: 0.2,
      minimumOutsideExtension: 96,
      maximumOutsideExtension: 180,
      maximumSpeed: 16,
    });
    expect(calculateCanvasCardAutoScrollOutsideExtension(320)).toBe(96);
    expect(calculateCanvasCardAutoScrollOutsideExtension(626)).toBeCloseTo(125.2);
    expect(calculateCanvasCardAutoScrollOutsideExtension(1_200)).toBe(180);
    expect(calculateCanvasCardAutoScroll(125, 74, 700)).toBeLessThan(0);
    expect(calculateCanvasCardAutoScroll(649, 74, 700)).toBeGreaterThan(0);
    expect(calculateCanvasCardAutoScroll(-500, 74, 700)).toBe(-16);
    expect(calculateCanvasCardAutoScroll(1_000, 74, 700)).toBe(16);
  });

  it("preserves production CanvasId branding through generic helpers", () => {
    type ProductionRuntime = CanvasBrowserRuntime<CanvasId>;
    const first = "canvas-a" as CanvasId;
    const second = "canvas-b" as CanvasId;
    const reordered = reorderCanvasCardToIndex([first, second], first, 1);

    expectTypeOf(reordered).toEqualTypeOf<readonly CanvasId[]>();
    expectTypeOf<Parameters<ProductionRuntime["beginDrag"]>[0]>().toEqualTypeOf<CanvasId>();
    expectTypeOf<Parameters<ProductionRuntime["reconcile"]>[0]>().toEqualTypeOf<
      readonly CanvasId[]
    >();
    expect(reordered).toEqual([second, first]);
  });
});
