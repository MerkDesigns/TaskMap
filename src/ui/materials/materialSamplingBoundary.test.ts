// @vitest-environment node
import { describe, expect, it } from "vitest";
import { calculateMaterialOverscan } from "./materialSamplingBoundary";

describe("material sampling boundary", () => {
  it("clamps every overscan side to the logical owner", () => {
    expect(
      calculateMaterialOverscan(
        { left: 105, top: 120, width: 100, height: 100 },
        { left: 100, top: 100, width: 300, height: 300 },
        23,
      ),
    ).toEqual({ left: 5, top: 20, right: 23, bottom: 23 });
  });

  it("depends only on geometry and ownership, not transient UI state", () => {
    const surface = { left: 90, top: 95, width: 120, height: 80 };
    const boundary = { left: 100, top: 100, width: 300, height: 300 };
    const settled = calculateMaterialOverscan(surface, boundary, 23);
    const dragging = calculateMaterialOverscan(surface, boundary, 23);
    const snapping = calculateMaterialOverscan(surface, boundary, 23);
    expect(dragging).toEqual(settled);
    expect(snapping).toEqual(settled);
    expect(settled).toEqual({ left: 0, top: 0, right: 23, bottom: 23 });
  });
});
