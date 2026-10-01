import { describe, expect, it } from "vitest";
import { canvasCardSpreadOffset } from "./canvasBrowserSlotGeometry";

describe("held-card neighbour spread", () => {
  it("keeps the first and last cards fixed and spaces each side evenly", () => {
    // Six cards, holding index 2: two above, three below.
    const offsets = [0, 1, 2, 3, 4, 5].map((index) => canvasCardSpreadOffset(index, 2, 6, 3) + 0);
    expect(offsets).toEqual([0, -1.5, 0, 2, 1, 0]);
    const gapsBelow = [3, 4].map((index) => offsets[index] - offsets[index + 1]);
    expect(gapsBelow).toEqual([1, 1]);
  });

  it("does not move an edge neighbour of a card held next to the list edge", () => {
    expect(canvasCardSpreadOffset(3, 2, 4, 3)).toBe(0);
    expect(canvasCardSpreadOffset(0, 1, 4, 3)).toBeCloseTo(0);
  });

  it("does nothing without a held card", () => {
    expect(canvasCardSpreadOffset(1, -1, 4, 3)).toBe(0);
  });
});
