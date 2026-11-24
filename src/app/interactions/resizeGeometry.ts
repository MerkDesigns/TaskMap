import { clamp } from "../../canvasMath";
import type { CanvasPoint, ElementGeometry } from "../../canvas/geometry/canvasGeometry";
import type { ResizeConstraints } from "./canvasInteractionTypes";

/**
 * The size for dragging the bottom-right corner `delta` away from where it started. With a fixed
 * ratio the corner follows the pointer projected onto the ratio's diagonal, so moving along
 * either axis alone resizes, inward as well as outward.
 */
export function resizeBottomRight(
  geometry: ElementGeometry,
  delta: CanvasPoint,
  constraints: ResizeConstraints,
): ElementGeometry {
  const width = geometry.width + delta.x;
  const height = geometry.height + delta.y;
  const ratio = constraints.aspectRatio;
  if (!ratio) return constrainResizeGeometry({ ...geometry, width, height }, constraints);
  const projected = ((width * ratio + height) / (ratio * ratio + 1)) * ratio;
  return constrainResizeGeometry(
    { ...geometry, width: projected, height: projected / ratio },
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
  } else if (ratio && height < constraints.minimum.height) {
    height = constraints.minimum.height;
    width = height * ratio;
  }
  return { ...geometry, width, height };
}
