// @vitest-environment node
import { describe, expect, it } from "vitest";
import { constrainResizeGeometry, resizeBottomRight } from "./resizeGeometry";

const constraints = {
  minimum: { width: 80, height: 80 },
  maximum: { width: 300, height: 200 },
};

describe("bottom-right resize geometry", () => {
  it("applies deltas and minimum/maximum constraints", () => {
    expect(
      resizeBottomRight({ x: 10, y: 20, width: 100, height: 100 }, { x: -50, y: 150 }, constraints),
    ).toEqual({ x: 10, y: 20, width: 80, height: 200 });
  });

  it("preserves aspect ratio and honors the tighter maximum axis", () => {
    expect(
      resizeBottomRight(
        { x: 10, y: 20, width: 160, height: 80 },
        { x: 300, y: 300 },
        { ...constraints, aspectRatio: 2 },
      ),
    ).toEqual({ x: 10, y: 20, width: 300, height: 150 });
  });

  it("reconstrains snapped geometry", () => {
    expect(
      constrainResizeGeometry(
        { x: 10, y: 20, width: 320, height: 160 },
        { ...constraints, aspectRatio: 2 },
      ),
    ).toEqual({ x: 10, y: 20, width: 300, height: 150 });
  });
});
