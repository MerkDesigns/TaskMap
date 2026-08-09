import type { CanvasSize } from "../../canvas/geometry/canvasGeometry";
import { screenRectangleToWorld } from "../../canvas/geometry/viewportMath";
import type { AdaptiveQuality } from "./compositor/adaptiveQuality";
import { evaluateCacheCoverage, type CacheCoverageEvaluation } from "./compositor/cacheCoverage";
import {
  createCacheBuildDescriptor,
  type CacheBuildDescriptor,
} from "./compositor/compositorTypes";
import { SHARED_ACRYLIC_PROFILE_REVISION } from "./compositor/sharedAcrylicProfile";
import type { MaterialBackdropPresentation } from "./materialCompositorPresentation";

export function createMaterialCacheBuild(
  presentation: MaterialBackdropPresentation,
  quality: AdaptiveQuality,
  lifecycleEpoch: number,
  buildSerial: number,
) {
  const descriptor = createCacheBuildDescriptor({
    lifecycleEpoch,
    buildSerial,
    sceneKey: presentation.sceneKey,
    sceneRevision: presentation.sceneRevision,
    sharedProfileRevision: SHARED_ACRYLIC_PROFILE_REVISION,
    anchorViewport: presentation.viewport,
    marginCssPx: quality.marginCssPx,
    cacheScale: quality.cacheScale,
    cacheCssSize: quality.cacheCssSize,
    cacheBackingSize: quality.cacheBackingSize,
    outputBackingSize: quality.compositorBackingSize,
  });
  const cacheWorldBounds = screenRectangleToWorld(
    {
      x: -quality.marginCssPx,
      y: -quality.marginCssPx,
      ...quality.cacheCssSize,
    },
    presentation.viewport,
  );
  return Object.freeze({
    descriptor,
    scene: presentation.buildScene(cacheWorldBounds, presentation.viewport.zoom),
  });
}

export function evaluateDesiredMaterialCache(
  presentation: MaterialBackdropPresentation,
  quality: AdaptiveQuality,
  candidate: CacheBuildDescriptor,
): CacheCoverageEvaluation | null {
  if (
    candidate.scene.key !== presentation.sceneKey ||
    candidate.scene.revision !== presentation.sceneRevision ||
    candidate.sharedProfileRevision !== SHARED_ACRYLIC_PROFILE_REVISION
  ) {
    return null;
  }
  return evaluateCacheCoverage(
    {
      anchorViewport: candidate.anchor.viewport,
      marginCssPx: candidate.anchor.marginCssPx,
      viewportCssSize: candidate.anchor.viewport.screen,
      outputBackingSize: candidate.outputBackingSize,
    },
    {
      viewport: presentation.viewport,
      outputBackingSize: quality.compositorBackingSize,
    },
  );
}

export function cacheBuildIdentity(descriptor: CacheBuildDescriptor | null): string | null {
  return descriptor
    ? `${descriptor.request.lifecycleEpoch}:${descriptor.request.buildSerial}`
    : null;
}

export function canvasSizesEqual(left: CanvasSize, right: CanvasSize): boolean {
  return left.width === right.width && left.height === right.height;
}
