// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { InteractionElement } from "./canvasInteractionTypes";
import { prepareSnapTargets, snapMovedGeometry, snapResizedGeometry } from "./snappingEngine";

function target(
  id: string,
  x: number,
  y: number,
  width = 100,
  height = 100,
  centerSnapping = false,
): InteractionElement {
  return {
    id,
    geometry: { x, y, width, height },
    locked: false,
    movable: true,
    resizable: true,
    centerSnapping,
  };
}

describe("snapping engine", () => {
  it("matches x/y start and end guides within eight world units", () => {
    const targets = prepareSnapTargets([target("target", 100, 200)]);
    const result = snapMovedGeometry({ x: 94, y: 206, width: 100, height: 100 }, false, targets, {
      x: 12,
      y: 34,
    });
    expect(result.geometry).toEqual({ x: 100, y: 200, width: 100, height: 100 });
    expect(result.guides).toEqual([
      { axis: "x", position: 100, pointerPosition: 34 },
      { axis: "x", position: 200, pointerPosition: 34 },
      { axis: "y", position: 200, pointerPosition: 12 },
      { axis: "y", position: 300, pointerPosition: 12 },
    ]);
  });

  it("adds center semantics only for opted-in mind-map geometry", () => {
    const targets = prepareSnapTargets([target("mindmap", 100, 100, 100, 100, true)]);
    expect(
      snapMovedGeometry({ x: 126, y: 126, width: 50, height: 50 }, true, targets, { x: 0, y: 0 })
        .geometry,
    ).toMatchObject({ x: 125, y: 125 });
    expect(
      snapMovedGeometry({ x: 126, y: 126, width: 50, height: 50 }, false, targets, { x: 0, y: 0 })
        .geometry,
    ).toMatchObject({ x: 126, y: 126 });
  });

  it("does not snap beyond the threshold and retains first-candidate tie ordering", () => {
    const tooFar = snapMovedGeometry(
      { x: 91, y: 0, width: 50, height: 50 },
      false,
      prepareSnapTargets([target("target", 100, 500)]),
      { x: 0, y: 0 },
    );
    expect(tooFar.geometry.x).toBe(91);
    const tie = snapMovedGeometry(
      { x: 100, y: 0, width: 50, height: 50 },
      false,
      prepareSnapTargets([target("first", 96, 500), target("second", 104, 700)]),
      { x: 0, y: 0 },
    );
    expect(tie.geometry.x).toBe(96);
  });

  it("snaps bottom-right resize and preserves aspect ratio", () => {
    const result = snapResizedGeometry(
      { x: 0, y: 0, width: 194, height: 97 },
      2,
      prepareSnapTargets([target("target", 100, 100)]),
      { x: 30, y: 40 },
    );
    expect(result.geometry).toEqual({ x: 0, y: 0, width: 200, height: 100 });
    expect(result.guides).toEqual([{ axis: "x", position: 200, pointerPosition: 40 }]);
  });
});
