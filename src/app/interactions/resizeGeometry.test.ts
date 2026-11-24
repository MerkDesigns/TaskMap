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

  it("shrinks a fixed-ratio element when the corner moves along one axis", () => {
    const ratio = { ...constraints, aspectRatio: 2 };
    const geometry = { x: 10, y: 20, width: 240, height: 120 };
    const left = resizeBottomRight(geometry, { x: -40, y: 0 }, ratio);
    expect(left.width).toBeCloseTo(208);
    expect(left.height).toBeCloseTo(104);
    const up = resizeBottomRight(geometry, { x: 0, y: -16 }, ratio);
    expect(up.width).toBeCloseTo(233.6);
    expect(up.height).toBeCloseTo(116.8);
  });

  it("returns to the starting size when the corner returns to where it started", () => {
    const ratio = { ...constraints, aspectRatio: 2 };
    const geometry = { x: 10, y: 20, width: 240, height: 120 };
    expect(resizeBottomRight(geometry, { x: 0, y: 0 }, ratio)).toEqual(geometry);
  });

  it("keeps a fixed-ratio element at least as tall as the minimum", () => {
    expect(
      constrainResizeGeometry(
        { x: 10, y: 20, width: 100, height: 50 },
        { minimum: { width: 80, height: 60 }, maximum: constraints.maximum, aspectRatio: 2 },
      ),
    ).toEqual({ x: 10, y: 20, width: 120, height: 60 });
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
