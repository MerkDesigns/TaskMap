// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  BENCHMARK_CARD_AUTO_SCROLL,
  BENCHMARK_CARD_AUTO_SCROLL_EDGE,
  BENCHMARK_CARD_AUTO_SCROLL_MAX,
  calculateBoundedCanvasCardScrollTop,
  calculateCanvasCardAutoScroll,
  calculateCanvasCardAutoScrollOutsideExtension,
  reorderCanvasCardsAtCenter,
} from "./benchmarkCanvasCardInteraction";

describe("benchmark Canvas Card physical reorder math", () => {
  it("reorders when the dragged center crosses the direction-aware neighbor midpoint", () => {
    const order = [0, 1, 2, 3, 4];
    expect(reorderCanvasCardsAtCenter(order, 2, 410, 300, 74, 0, 92)).toEqual([0, 1, 3, 2, 4]);
    expect(reorderCanvasCardsAtCenter(order, 2, 120, 240, 74, 0, 92)).toEqual([0, 2, 1, 3, 4]);
  });

  it("accounts for scrollTop when calculating row midpoints", () => {
    expect(reorderCanvasCardsAtCenter([0, 1, 2], 1, 230, 180, 74, 100, 92)).toEqual([0, 2, 1]);
  });

  it("preserves the existing 52px in-browser start trigger positions", () => {
    const listTop = 74;
    const listBottom = 700;
    expect(BENCHMARK_CARD_AUTO_SCROLL_EDGE).toBe(52);
    expect(calculateCanvasCardAutoScroll(listTop + 52, listTop, listBottom)).toBe(0);
    expect(calculateCanvasCardAutoScroll(listTop + 51, listTop, listBottom)).toBeLessThan(0);
    expect(calculateCanvasCardAutoScroll(listBottom - 52, listTop, listBottom)).toBe(0);
    expect(calculateCanvasCardAutoScroll(listBottom - 51, listTop, listBottom)).toBeGreaterThan(0);
  });

  it("extends height-scaled acceleration endpoints outside the browser with clamps", () => {
    expect(calculateCanvasCardAutoScrollOutsideExtension(320)).toBe(96);
    expect(calculateCanvasCardAutoScrollOutsideExtension(626)).toBeCloseTo(125.2);
    expect(calculateCanvasCardAutoScrollOutsideExtension(1_200)).toBe(180);
  });

  it("ramps smoothly through the extended zone and caps beyond its endpoint", () => {
    const listTop = 74;
    const listBottom = 700;
    const extension = calculateCanvasCardAutoScrollOutsideExtension(listBottom - listTop);
    const topSamples = [110, 74, 20, listTop - extension].map((pointerY) =>
      Math.abs(calculateCanvasCardAutoScroll(pointerY, listTop, listBottom)),
    );
    const bottomSamples = [664, 700, 754, listBottom + extension].map((pointerY) =>
      calculateCanvasCardAutoScroll(pointerY, listTop, listBottom),
    );

    expect(topSamples[0]).toBeLessThan(topSamples[1]);
    expect(topSamples[1]).toBeLessThan(topSamples[2]);
    expect(topSamples[2]).toBeLessThan(topSamples[3]);
    expect(bottomSamples[0]).toBeLessThan(bottomSamples[1]);
    expect(bottomSamples[1]).toBeLessThan(bottomSamples[2]);
    expect(bottomSamples[2]).toBeLessThan(bottomSamples[3]);
    expect(calculateCanvasCardAutoScroll(listTop - extension - 200, listTop, listBottom)).toBe(
      -BENCHMARK_CARD_AUTO_SCROLL_MAX,
    );
    expect(calculateCanvasCardAutoScroll(listBottom + extension + 200, listTop, listBottom)).toBe(
      BENCHMARK_CARD_AUTO_SCROLL.maximumSpeed,
    );
  });

  it("stops at either list bound and when there is no overflow", () => {
    expect(calculateBoundedCanvasCardScrollTop(0, -16, 798, 1_840)).toBe(0);
    expect(calculateBoundedCanvasCardScrollTop(1_042, 16, 798, 1_840)).toBe(1_042);
    expect(calculateBoundedCanvasCardScrollTop(0, 16, 798, 798)).toBe(0);
  });
});
