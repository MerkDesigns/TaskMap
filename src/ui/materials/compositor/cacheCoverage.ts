import type { CanvasRectangle, CanvasSize } from "../../../canvas/geometry/canvasGeometry";
import {
  viewportWorldRectangle,
  worldToScreen,
  type CanvasViewport,
} from "../../../canvas/geometry/viewportMath";

export const ZOOM_RATIO_MIN = 0.68;
export const ZOOM_RATIO_MAX = 1.47;
export const CACHE_MARGIN_SAFETY = 0.3;

export interface AcceptedCacheCoverage {
  readonly anchorViewport: CanvasViewport;
  readonly marginCssPx: number;
  readonly viewportCssSize: CanvasSize;
  readonly outputBackingSize: CanvasSize;
}

export interface CurrentCacheCoverage {
  readonly viewport: CanvasViewport;
  readonly outputBackingSize: CanvasSize;
}

export type CacheCoverageRebuildReason =
  | "invalid-input"
  | "viewport-size-changed"
  | "output-size-changed"
  | "zoom-ratio-outside"
  | "cache-left-safety"
  | "cache-right-safety"
  | "cache-top-safety"
  | "cache-bottom-safety";

export interface CacheCoverageEvaluation {
  readonly requiresRebuild: boolean;
  readonly reasons: readonly CacheCoverageRebuildReason[];
  readonly zoomRatio: number | null;
  readonly transformedViewportInAnchorCss: CanvasRectangle | null;
}

/** Geometric coverage only; scene, profile, and lifecycle relevance are scheduler concerns. */
export function evaluateCacheCoverage(
  accepted: AcceptedCacheCoverage,
  current: CurrentCacheCoverage,
): CacheCoverageEvaluation {
  if (!isValidCoverageInput(accepted, current)) {
    return result(["invalid-input"], null, null);
  }

  const reasons: CacheCoverageRebuildReason[] = [];
  if (!sizesEqual(current.viewport.screen, accepted.viewportCssSize)) {
    reasons.push("viewport-size-changed");
  }
  if (!sizesEqual(current.outputBackingSize, accepted.outputBackingSize)) {
    reasons.push("output-size-changed");
  }

  const zoomRatio = current.viewport.zoom / accepted.anchorViewport.zoom;
  if (!isZoomRatioWithinCacheRange(zoomRatio)) reasons.push("zoom-ratio-outside");

  const worldViewport = viewportWorldRectangle(current.viewport);
  const transformedOrigin = worldToScreen(worldViewport, accepted.anchorViewport);
  const transformedViewport = Object.freeze({
    ...transformedOrigin,
    width: worldViewport.width * accepted.anchorViewport.zoom,
    height: worldViewport.height * accepted.anchorViewport.zoom,
  });
  const retainedMargin = accepted.marginCssPx * (1 - CACHE_MARGIN_SAFETY);
  const leftLimit = -retainedMargin;
  const topLimit = -retainedMargin;
  const rightLimit = accepted.viewportCssSize.width + retainedMargin;
  const bottomLimit = accepted.viewportCssSize.height + retainedMargin;

  if (transformedViewport.x <= leftLimit) reasons.push("cache-left-safety");
  if (transformedViewport.x + transformedViewport.width >= rightLimit) {
    reasons.push("cache-right-safety");
  }
  if (transformedViewport.y <= topLimit) reasons.push("cache-top-safety");
  if (transformedViewport.y + transformedViewport.height >= bottomLimit) {
    reasons.push("cache-bottom-safety");
  }

  return result(reasons, zoomRatio, transformedViewport);
}

export function isZoomRatioWithinCacheRange(zoomRatio: number): boolean {
  return Number.isFinite(zoomRatio) && zoomRatio >= ZOOM_RATIO_MIN && zoomRatio <= ZOOM_RATIO_MAX;
}

function result(
  reasons: readonly CacheCoverageRebuildReason[],
  zoomRatio: number | null,
  transformedViewportInAnchorCss: CanvasRectangle | null,
): CacheCoverageEvaluation {
  const frozenReasons = Object.freeze([...reasons]);
  return Object.freeze({
    requiresRebuild: frozenReasons.length > 0,
    reasons: frozenReasons,
    zoomRatio,
    transformedViewportInAnchorCss,
  });
}

function isValidCoverageInput(
  accepted: AcceptedCacheCoverage,
  current: CurrentCacheCoverage,
): boolean {
  return (
    isValidViewport(accepted.anchorViewport) &&
    isValidViewport(current.viewport) &&
    isPositiveFinite(accepted.marginCssPx) &&
    isPositiveSize(accepted.viewportCssSize) &&
    isPositiveIntegerSize(accepted.outputBackingSize) &&
    isPositiveIntegerSize(current.outputBackingSize) &&
    sizesEqual(accepted.anchorViewport.screen, accepted.viewportCssSize)
  );
}

function isValidViewport(viewport: CanvasViewport): boolean {
  return (
    Number.isFinite(viewport.pan.x) &&
    Number.isFinite(viewport.pan.y) &&
    isPositiveFinite(viewport.zoom) &&
    isPositiveSize(viewport.screen)
  );
}

function isPositiveSize(size: CanvasSize): boolean {
  return isPositiveFinite(size.width) && isPositiveFinite(size.height);
}

function isPositiveIntegerSize(size: CanvasSize): boolean {
  return isPositiveSize(size) && Number.isInteger(size.width) && Number.isInteger(size.height);
}

function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function sizesEqual(left: CanvasSize, right: CanvasSize): boolean {
  return left.width === right.width && left.height === right.height;
}
