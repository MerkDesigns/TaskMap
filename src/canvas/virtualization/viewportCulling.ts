import {
  rectanglesIntersect,
  type CanvasRectangle,
  type ElementGeometry,
} from "../geometry/canvasGeometry";
import { viewportWorldRectangle, type CanvasViewport } from "../geometry/viewportMath";

export const CANVAS_RENDER_OVERSCAN_SCREEN_PX = 480;

export interface CullableElement {
  readonly id: string;
  readonly geometry: ElementGeometry;
}

export interface ViewportCullingInput {
  readonly viewport: CanvasViewport;
  readonly elements: readonly CullableElement[];
  readonly pinnedIds?: ReadonlySet<string>;
  readonly overscanScreen?: number;
}

export function overscannedWorldRectangle(
  viewport: CanvasViewport,
  overscanScreen = CANVAS_RENDER_OVERSCAN_SCREEN_PX,
): CanvasRectangle {
  const visible = viewportWorldRectangle(viewport);
  const overscanWorld = Math.max(0, overscanScreen) / viewport.zoom;
  return {
    x: visible.x - overscanWorld,
    y: visible.y - overscanWorld,
    width: visible.width + overscanWorld * 2,
    height: visible.height + overscanWorld * 2,
  };
}

export function getVisibleElementIds({
  viewport,
  elements,
  pinnedIds = new Set<string>(),
  overscanScreen,
}: ViewportCullingInput): Set<string> {
  const rectangle = overscannedWorldRectangle(viewport, overscanScreen);
  return new Set(
    elements
      .filter(({ id, geometry }) => pinnedIds.has(id) || rectanglesIntersect(rectangle, geometry))
      .map(({ id }) => id),
  );
}
