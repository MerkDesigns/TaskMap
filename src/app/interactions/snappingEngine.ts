import { findSnapOffset } from "../../canvasMath";
import type { CanvasPoint, ElementGeometry } from "../../canvas/geometry/canvasGeometry";
import type { InteractionElement, SnapGuide } from "./canvasInteractionTypes";

type AlignmentKind = "start" | "center" | "end";
type AlignmentGuide = { readonly value: number; readonly kind: AlignmentKind };

export interface PreparedSnapTargets {
  readonly x: readonly AlignmentGuide[];
  readonly y: readonly AlignmentGuide[];
}

export function prepareSnapTargets(targets: readonly InteractionElement[]): PreparedSnapTargets {
  return {
    x: targets.flatMap(({ geometry, centerSnapping }) => [
      { value: geometry.x, kind: "start" as const },
      ...(centerSnapping
        ? [{ value: geometry.x + geometry.width / 2, kind: "center" as const }]
        : []),
      { value: geometry.x + geometry.width, kind: "end" as const },
    ]),
    y: targets.flatMap(({ geometry, centerSnapping }) => [
      { value: geometry.y, kind: "start" as const },
      ...(centerSnapping
        ? [{ value: geometry.y + geometry.height / 2, kind: "center" as const }]
        : []),
      { value: geometry.y + geometry.height, kind: "end" as const },
    ]),
  };
}

export function snapMovedGeometry(
  geometry: ElementGeometry,
  centerSnapping: boolean,
  targets: PreparedSnapTargets,
  pointer: CanvasPoint,
): { geometry: ElementGeometry; guides: SnapGuide[] } {
  const x = findSnapOffset(axisGuides(geometry.x, geometry.width, centerSnapping), [...targets.x]);
  const y = findSnapOffset(axisGuides(geometry.y, geometry.height, centerSnapping), [...targets.y]);
  return {
    geometry: { ...geometry, x: geometry.x + x.offset, y: geometry.y + y.offset },
    guides: [
      ...x.guides.map((position) => ({ axis: "x" as const, position, pointerPosition: pointer.y })),
      ...y.guides.map((position) => ({ axis: "y" as const, position, pointerPosition: pointer.x })),
    ],
  };
}

export function snapResizedGeometry(
  geometry: ElementGeometry,
  aspectRatio: number | undefined,
  targets: PreparedSnapTargets,
  pointer: CanvasPoint,
): { geometry: ElementGeometry; guides: SnapGuide[] } {
  const x = findSnapOffset([{ value: geometry.x + geometry.width, kind: "end" }], [...targets.x]);
  const y = findSnapOffset([{ value: geometry.y + geometry.height, kind: "end" }], [...targets.y]);
  if (
    aspectRatio &&
    y.guide !== null &&
    (x.guide === null || Math.abs(y.offset) < Math.abs(x.offset))
  ) {
    const height = geometry.height + y.offset;
    return {
      geometry: { ...geometry, width: height * aspectRatio, height },
      guides: [{ axis: "y", position: y.guide, pointerPosition: pointer.x }],
    };
  }
  if (x.guide !== null) {
    const width = geometry.width + x.offset;
    return {
      geometry: { ...geometry, width, height: aspectRatio ? width / aspectRatio : geometry.height },
      guides: [{ axis: "x", position: x.guide, pointerPosition: pointer.y }],
    };
  }
  if (y.guide !== null) {
    return {
      geometry: { ...geometry, height: geometry.height + y.offset },
      guides: [{ axis: "y", position: y.guide, pointerPosition: pointer.x }],
    };
  }
  return { geometry, guides: [] };
}

function axisGuides(start: number, size: number, center: boolean): AlignmentGuide[] {
  return [
    { value: start, kind: "start" },
    ...(center ? [{ value: start + size / 2, kind: "center" as const }] : []),
    { value: start + size, kind: "end" },
  ];
}
