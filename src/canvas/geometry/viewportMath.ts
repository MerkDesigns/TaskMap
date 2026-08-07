import { getWheelZoom, quantizeZoom } from "../../canvasMath";
import type { CanvasPoint, CanvasRectangle, CanvasSize } from "./canvasGeometry";

export interface CanvasViewport {
  readonly pan: CanvasPoint;
  readonly zoom: number;
  readonly screen: CanvasSize;
}

export function createViewport(pan: CanvasPoint, zoom: number, screen: CanvasSize): CanvasViewport {
  return {
    pan: finitePoint(pan),
    zoom: quantizeZoom(Number.isFinite(zoom) ? zoom : 1),
    screen: finiteSize(screen),
  };
}

export function screenToWorld(point: CanvasPoint, viewport: CanvasViewport): CanvasPoint {
  return {
    x: (point.x - viewport.pan.x) / viewport.zoom,
    y: (point.y - viewport.pan.y) / viewport.zoom,
  };
}

export function worldToScreen(point: CanvasPoint, viewport: CanvasViewport): CanvasPoint {
  return {
    x: viewport.pan.x + point.x * viewport.zoom,
    y: viewport.pan.y + point.y * viewport.zoom,
  };
}

export function translateViewport(
  viewport: CanvasViewport,
  screenDelta: CanvasPoint,
): CanvasViewport {
  return createViewport(
    { x: viewport.pan.x + screenDelta.x, y: viewport.pan.y + screenDelta.y },
    viewport.zoom,
    viewport.screen,
  );
}

export function zoomViewportAt(
  viewport: CanvasViewport,
  screenAnchor: CanvasPoint,
  requestedZoom: number,
): CanvasViewport {
  const anchor = finitePoint(screenAnchor);
  const worldAnchor = screenToWorld(anchor, viewport);
  const zoom = quantizeZoom(requestedZoom);
  return createViewport(
    { x: anchor.x - worldAnchor.x * zoom, y: anchor.y - worldAnchor.y * zoom },
    zoom,
    viewport.screen,
  );
}

export function wheelZoomViewport(
  viewport: CanvasViewport,
  screenAnchor: CanvasPoint,
  deltaY: number,
): CanvasViewport {
  return zoomViewportAt(viewport, screenAnchor, getWheelZoom(viewport.zoom, deltaY));
}

export function resetViewportZoom(viewport: CanvasViewport): CanvasViewport {
  return zoomViewportAt(
    viewport,
    { x: viewport.screen.width / 2, y: viewport.screen.height / 2 },
    1,
  );
}

export function viewportWorldRectangle(viewport: CanvasViewport): CanvasRectangle {
  const origin = screenToWorld({ x: 0, y: 0 }, viewport);
  return {
    ...origin,
    width: viewport.screen.width / viewport.zoom,
    height: viewport.screen.height / viewport.zoom,
  };
}

export function screenRectangleToWorld(
  rectangle: CanvasRectangle,
  viewport: CanvasViewport,
): CanvasRectangle {
  const origin = screenToWorld(rectangle, viewport);
  return {
    ...origin,
    width: rectangle.width / viewport.zoom,
    height: rectangle.height / viewport.zoom,
  };
}

function finitePoint(point: CanvasPoint): CanvasPoint {
  return {
    x: Number.isFinite(point.x) ? point.x : 0,
    y: Number.isFinite(point.y) ? point.y : 0,
  };
}

function finiteSize(size: CanvasSize): CanvasSize {
  return {
    width: Number.isFinite(size.width) ? Math.max(0, size.width) : 0,
    height: Number.isFinite(size.height) ? Math.max(0, size.height) : 0,
  };
}
