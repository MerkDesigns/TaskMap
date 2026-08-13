// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  BENCHMARK_CARD_AUTO_SCROLL_MAX,
  calculateCanvasCardAutoScroll,
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

  it("accelerates auto-scroll toward either browser edge", () => {
    expect(calculateCanvasCardAutoScroll(74, 74, 700)).toBe(-BENCHMARK_CARD_AUTO_SCROLL_MAX);
    expect(calculateCanvasCardAutoScroll(700, 74, 700)).toBe(BENCHMARK_CARD_AUTO_SCROLL_MAX);
    expect(calculateCanvasCardAutoScroll(350, 74, 700)).toBe(0);
    expect(Math.abs(calculateCanvasCardAutoScroll(84, 74, 700))).toBeGreaterThan(
      Math.abs(calculateCanvasCardAutoScroll(110, 74, 700)),
    );
  });
});
