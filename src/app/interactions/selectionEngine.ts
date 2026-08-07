import {
  normalizeRectangle,
  rectanglesIntersect,
  type CanvasPoint,
  type CanvasRectangle,
} from "../../canvas/geometry/canvasGeometry";
import type { InteractionElement } from "./canvasInteractionTypes";

export const MINIMUM_SELECTION_BOX_WORLD_UNITS = 4;

export function selectionRectangle(start: CanvasPoint, current: CanvasPoint): CanvasRectangle {
  return normalizeRectangle(start, current);
}

export function isTinySelection(rectangle: CanvasRectangle): boolean {
  return (
    rectangle.width < MINIMUM_SELECTION_BOX_WORLD_UNITS &&
    rectangle.height < MINIMUM_SELECTION_BOX_WORLD_UNITS
  );
}

export function selectIntersectingIds(
  rectangle: CanvasRectangle,
  candidates: readonly InteractionElement[],
): string[] {
  return candidates
    .filter((candidate) => rectanglesIntersect(rectangle, candidate.geometry))
    .map((candidate) => candidate.id);
}

export function mergeSelection(
  current: readonly string[],
  incoming: readonly string[],
  additive: boolean,
): string[] {
  if (!additive) return [...incoming];
  return [...new Set([...current, ...incoming])];
}
