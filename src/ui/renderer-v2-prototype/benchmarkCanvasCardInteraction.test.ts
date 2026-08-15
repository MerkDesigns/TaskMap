// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  BENCHMARK_CARD_AUTO_SCROLL,
  BENCHMARK_CARD_AUTO_SCROLL_EDGE,
  BENCHMARK_CARD_AUTO_SCROLL_MAX,
  calculateCanvasCardAutoScroll,
  calculateCanvasCardAutoScrollOutsideExtension,
  calculateCanvasCardInteractionCenter,
  calculateCanvasCardInsertionIndex,
  reorderCanvasCardToIndex,
} from "./benchmarkCanvasCardInteraction";
import { benchmarkCanvasId } from "./benchmarkCanvasIds";

const ids = Array.from({ length: 6 }, (_, index) => benchmarkCanvasId(index));

describe("benchmark Canvas Card physical reorder math", () => {
  it("derives an absolute insertion slot from the current center and scroll position", () => {
    const order = ids.slice(0, 5);
    const down = calculateCanvasCardInsertionIndex(order, ids[2], 410, 74, 0, 92);
    const up = calculateCanvasCardInsertionIndex(order, ids[2], 150, 74, 0, 92);

    expect(reorderCanvasCardToIndex(order, ids[2], down)).toEqual([
      ids[0],
      ids[1],
      ids[3],
      ids[2],
      ids[4],
    ]);
    expect(reorderCanvasCardToIndex(order, ids[2], up)).toEqual([
      ids[0],
      ids[2],
      ids[1],
      ids[3],
      ids[4],
    ]);
  });

  it("changes insertion while the center is stationary and only scroll moves", () => {
    const order = ids.slice(0, 5);
    expect(calculateCanvasCardInsertionIndex(order, ids[2], 300, 74, 0, 92)).toBe(2);
    expect(calculateCanvasCardInsertionIndex(order, ids[2], 300, 74, 120, 92)).toBe(3);
  });

  it("supports deterministic multi-slot movement and preserves identity at the same slot", () => {
    const order = [...ids];
    const target = calculateCanvasCardInsertionIndex(order, ids[1], 580, 74, 0, 92);
    expect(target).toBe(5);
    expect(reorderCanvasCardToIndex(order, ids[1], target)).toEqual([
      ids[0],
      ids[2],
      ids[3],
      ids[4],
      ids[5],
      ids[1],
    ]);
    expect(reorderCanvasCardToIndex(order, ids[1], 1)).toBe(order);
  });

  it("clamps only the reorder coordinate when the pointer is outside the browser", () => {
    expect(calculateCanvasCardInteractionCenter(-100, 42, 74, 488, 84)).toBe(74);
    expect(calculateCanvasCardInteractionCenter(700, 42, 74, 488, 84)).toBe(488);
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
});
