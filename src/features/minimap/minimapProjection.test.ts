// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createMinimapProjection } from "./minimapProjection";

describe("minimap projection", () => {
  it("projects canvas, element, and viewport bounds without document data", () => {
    const result = createMinimapProjection(
      { width: 4000, height: 2000 },
      { x: 1000, y: 500, width: 2000, height: 1000 },
      [{ id: "a", geometry: { x: 400, y: 200, width: 20, height: 20 }, minimumPixels: 4 }],
      240,
    );
    expect(result.size).toEqual({ width: 240, height: 120 });
    expect(result.elements.get("a")).toEqual({ x: 24, y: 12, width: 4, height: 4 });
    expect(result.viewport).toEqual({ x: 60, y: 30, width: 120, height: 60 });
  });

  it("handles portrait and degenerate canvas sizes", () => {
    expect(
      createMinimapProjection({ width: 0, height: 2 }, { x: 0, y: 0, width: 1, height: 1 }, [], 240)
        .size,
    ).toEqual({ width: 120, height: 240 });
  });
});
