import {
  normalizeRectangle,
  rectanglesIntersect,
  type CanvasPoint,
  type CanvasRectangle,
} from "../../canvas/geometry/canvasGeometry";
import type { InteractionElement, SelectionScope } from "./canvasInteractionTypes";

export const MINIMUM_SELECTION_BOX_WORLD_UNITS = 4;

export function selectionRectangle(start: CanvasPoint, current: CanvasPoint): CanvasRectangle {
  return normalizeRectangle(start, current);
}

const NO_OFFSET: CanvasPoint = { x: 0, y: 0 };

/** Where a world point lies in the scope's content, which may be scrolled. */
export function selectionContentPoint(world: CanvasPoint, scope: SelectionScope): CanvasPoint {
  const offset = scope.contentOffset?.() ?? NO_OFFSET;
  return { x: world.x + offset.x, y: world.y + offset.y };
}

/**
 * The box from its content-space start to the pointer: `content` selects among the candidates,
 * `shown` is where it currently appears, moved with any scrolling. Edges that scrolled away stay
 * where they are; the scope's clip hides them rather than redrawing the box smaller.
 */
export function selectionRectangles(
  startContent: CanvasPoint,
  pointerWorld: CanvasPoint,
  scope: SelectionScope,
): { readonly content: CanvasRectangle; readonly shown: CanvasRectangle } {
  const offset = scope.contentOffset?.() ?? NO_OFFSET;
  const content = normalizeRectangle(startContent, {
    x: pointerWorld.x + offset.x,
    y: pointerWorld.y + offset.y,
  });
  return { content, shown: { ...content, x: content.x - offset.x, y: content.y - offset.y } };
}

/** The box a selection gesture shows and the selection it would make if released now. */
export function previewSelection(
  startContent: CanvasPoint,
  pointerWorld: CanvasPoint,
  scope: SelectionScope,
  selectedIds: readonly string[],
): {
  readonly selectionRectangle: CanvasRectangle;
  readonly selectionClip: CanvasRectangle | null;
  readonly selectionPreviewIds: string[];
} {
  const { content, shown } = selectionRectangles(startContent, pointerWorld, scope);
  const incoming = isTinySelection(content) ? [] : selectIntersectingIds(content, scope.candidates);
  return {
    selectionRectangle: shown,
    selectionClip: scope.clip ?? null,
    selectionPreviewIds: mergeSelection(selectedIds, incoming, scope.additive),
  };
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
