import { clamp } from "../../canvasMath";
import type { CanvasPoint, ElementGeometry } from "../../canvas/geometry/canvasGeometry";
import type { ResizeConstraints } from "./canvasInteractionTypes";

export function resizeBottomRight(
  geometry: ElementGeometry,
  delta: CanvasPoint,
  constraints: ResizeConstraints,
): ElementGeometry {
  const ratio = constraints.aspectRatio;
  const widthDelta = Math.max(delta.x, ratio ? delta.y * ratio : delta.x);
  return constrainResizeGeometry(
    {
      ...geometry,
      width: geometry.width + widthDelta,
      height: ratio ? (geometry.width + widthDelta) / ratio : geometry.height + delta.y,
    },
    constraints,
  );
}

export function constrainResizeGeometry(
  geometry: ElementGeometry,
  constraints: ResizeConstraints,
): ElementGeometry {
  const ratio = constraints.aspectRatio;
  let width = clamp(geometry.width, constraints.minimum.width, constraints.maximum.width);
  let height = ratio
    ? width / ratio
    : clamp(geometry.height, constraints.minimum.height, constraints.maximum.height);
  if (ratio && height > constraints.maximum.height) {
    height = constraints.maximum.height;
    width = height * ratio;
  }
  return { ...geometry, width, height };
}
