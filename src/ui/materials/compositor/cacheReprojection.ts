import type { CanvasRectangle, CanvasSize } from "../../../canvas/geometry/canvasGeometry";
import type { CanvasViewport } from "../../../canvas/geometry/viewportMath";
import type { CacheBuildDescriptor } from "./compositorTypes";

export interface CacheReprojection {
  readonly source: CanvasRectangle;
  readonly destination: CanvasRectangle;
}

/** Maps the current Phase 4 viewport into an accepted anchor cache without a second camera model. */
export function calculateCacheReprojection(
  descriptor: CacheBuildDescriptor,
  currentViewport: CanvasViewport,
  outputBackingSize: CanvasSize,
): CacheReprojection {
  const anchor = descriptor.anchor.viewport;
  const zoomRatio = anchor.zoom / currentViewport.zoom;
  const worldOrigin = {
    x: -currentViewport.pan.x / currentViewport.zoom,
    y: -currentViewport.pan.y / currentViewport.zoom,
  };
  const anchorScreenOrigin = {
    x: anchor.pan.x + worldOrigin.x * anchor.zoom,
    y: anchor.pan.y + worldOrigin.y * anchor.zoom,
  };
  const source = Object.freeze({
    x: (descriptor.anchor.marginCssPx + anchorScreenOrigin.x) * descriptor.anchor.cacheScale,
    y: (descriptor.anchor.marginCssPx + anchorScreenOrigin.y) * descriptor.anchor.cacheScale,
    width: currentViewport.screen.width * zoomRatio * descriptor.anchor.cacheScale,
    height: currentViewport.screen.height * zoomRatio * descriptor.anchor.cacheScale,
  });
  return Object.freeze({
    source,
    destination: Object.freeze({ x: 0, y: 0, ...outputBackingSize }),
  });
}
