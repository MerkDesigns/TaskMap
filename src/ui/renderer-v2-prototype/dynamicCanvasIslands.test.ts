// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { BenchmarkAnimationSettings, BenchmarkElementModel } from "./benchmarkTypes";
import { selectDynamicCanvasElements } from "./dynamicCanvasIslands";

const animations = (overrides: Partial<BenchmarkAnimationSettings>) => ({
  moveCards: false,
  moveImage: false,
  showGif: false,
  ...overrides,
});

const element = (ordinal: number): BenchmarkElementModel => ({
  id: `element-${ordinal}`,
  kind: "text-card",
  x: ordinal * 10,
  y: ordinal * 20,
  width: 248,
  height: 164,
  z: 10 + ordinal,
  ordinal,
});

describe("dynamic Canvas Element classification", () => {
  it("keeps static elements in the coarse set and promotes only affected visible elements", () => {
    const visible = [element(0), element(1), element(5), element(7), element(10)];
    const promoted = selectDynamicCanvasElements(
      visible,
      animations({ moveCards: true }),
      "dynamic-islands",
    );

    expect(promoted.map(({ element: item }) => item.id)).toEqual([
      "element-0",
      "element-5",
      "element-10",
    ]);
    expect(
      visible.filter((item) => !promoted.some(({ element }) => element.id === item.id)),
    ).toEqual([element(1), element(7)]);
    expect(promoted.every(({ positionOnly }) => positionOnly)).toBe(true);
  });

  it("classifies CSS image motion and GIF pixels as content-changing", () => {
    const visible = [element(7), element(10), element(11)];
    const promoted = selectDynamicCanvasElements(
      visible,
      animations({ moveImage: true, showGif: true }),
      "dynamic-islands",
    );

    expect(promoted.map(({ element: item }) => item.id)).toEqual(["element-7", "element-10"]);
    expect(promoted.every(({ positionOnly }) => !positionOnly)).toBe(true);
  });

  it.each([
    ["moveImage only", animations({ moveImage: true }), [0, 7, 14]],
    ["GIF only", animations({ showGif: true }), [0, 10]],
    [
      "all animations",
      animations({ moveCards: true, moveImage: true, showGif: true }),
      [0, 5, 7, 10, 14, 15],
    ],
  ])("selects the expected elements for %s", (_label, settings, expectedOrdinals) => {
    const visible = Array.from({ length: 20 }, (_, ordinal) => element(ordinal));
    expect(
      selectDynamicCanvasElements(visible, settings, "dynamic-islands").map(
        ({ element: item }) => item.ordinal,
      ),
    ).toEqual(expectedOrdinals);
  });

  it("disables promotion for the coarse comparison mode", () => {
    expect(
      selectDynamicCanvasElements(
        [element(0)],
        animations({ moveCards: true, moveImage: true, showGif: true }),
        "coarse-canvas",
      ),
    ).toEqual([]);
  });
});
