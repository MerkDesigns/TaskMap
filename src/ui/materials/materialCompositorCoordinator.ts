import type { CanvasViewport } from "../../canvas/geometry/viewportMath";
import type { AcrylicCacheRuntime } from "./compositor/acrylicCacheRuntime";
import type { TransferableCacheBitmap } from "./compositor/acrylicCanvas";
import { calculateAdaptiveQuality, type AdaptiveQuality } from "./compositor/adaptiveQuality";
import {
  createComposeFrameState,
  consumeComposeFrame,
  disposeComposeFrames,
  notifyComposeDirty,
  type ComposeFrameState,
} from "./compositor/frameCoalescing";
import type { CompositorOutputPlaneSet } from "./compositor/compositorOutputPlanes";
import {
  cacheBuildIdentity,
  canvasSizesEqual,
  createMaterialCacheBuild,
  evaluateDesiredMaterialCache,
} from "./materialCompositorCachePolicy";
import type { MaterialCompositorDiagnosticsStore } from "./materialCompositorDiagnostics";
import type { MaterialBackdropPresentation } from "./materialCompositorPresentation";
import type { MaterialSurfaceRegistry } from "./materialSurfaceRegistry";

export interface CompositorFrameScheduler {
  request(callback: () => void): number;
  cancel(handle: number): void;
}

export interface MaterialCompositorCoordinator {
  updatePresentation(presentation: MaterialBackdropPresentation | null): void;
  notifySurfaceGeometryChanged(): void;
  dispose(): void;
}

export interface MaterialCompositorCoordinatorOptions {
  readonly runtime: AcrylicCacheRuntime<TransferableCacheBitmap>;
  readonly surfaces: MaterialSurfaceRegistry;
  readonly outputs: CompositorOutputPlaneSet;
  readonly frames: CompositorFrameScheduler;
  readonly diagnostics: MaterialCompositorDiagnosticsStore;
}

export function createMaterialCompositorCoordinator(
  options: MaterialCompositorCoordinatorOptions,
): MaterialCompositorCoordinator {
  let disposed = false;
  let presentation: MaterialBackdropPresentation | null = null;
  let quality: AdaptiveQuality | null = null;
  let lifecycleEpoch = 1;
  let buildSerial = 0;
  let lastSceneKey: string | null = null;
  let frameState: ComposeFrameState<CanvasViewport> = createComposeFrameState();
  let frameHandle: number | null = null;
  let composing = false;
  let renderedPlaneRevisions = { base: -1, modal: -1 };
  let previousSurfaceCount = 0;
  let previousActiveIdentity: string | null = null;
  let previousStartKey: string | null = null;
  let previousAcceptedIdentity: string | null = null;

  const scheduleCompose = (viewport: CanvasViewport) => {
    const transition = notifyComposeDirty(frameState, viewport);
    frameState = transition.state;
    if (!transition.shouldScheduleFrame) return;
    frameHandle = options.frames.request(composeFrame);
  };

  const composeFrame = () => {
    frameHandle = null;
    const consumption = consumeComposeFrame(frameState);
    frameState = consumption.state;
    if (disposed || !consumption.value) return;
    composing = true;
    options.surfaces.refreshMeasurements();
    const surfaceSnapshot = options.surfaces.getSnapshot();
    if (surfaceSnapshot.surfaces.length === 0 || !quality) {
      options.outputs.clear();
    } else {
      for (const plane of ["base", "modal"] as const) {
        if (renderedPlaneRevisions[plane] === surfaceSnapshot.planeRevisions[plane]) continue;
        options.outputs.rebuildMask(
          plane,
          surfaceSnapshot.surfaces.filter((surface) => surface.plane === plane),
          quality.compositeScale,
        );
        renderedPlaneRevisions = {
          ...renderedPlaneRevisions,
          [plane]: surfaceSnapshot.planeRevisions[plane],
        };
        const diagnostics = options.diagnostics.getSnapshot();
        options.diagnostics.update({
          maskRebuilds: {
            ...diagnostics.maskRebuilds,
            [plane]: diagnostics.maskRebuilds[plane] + 1,
          },
        });
      }
      const accepted = options.runtime.getSnapshot().accepted;
      options.outputs.compose(
        accepted?.descriptor.scene.key === presentation?.sceneKey ? accepted : null,
        consumption.value,
      );
    }
    composing = false;
    options.diagnostics.update({
      composeFrames: options.diagnostics.getSnapshot().composeFrames + 1,
    });
  };

  const updateRuntimeDiagnostics = () => {
    const runtime = options.runtime.getSnapshot();
    const activeIdentity = cacheBuildIdentity(runtime.scheduler.active);
    const acceptedIdentity = cacheBuildIdentity(runtime.accepted?.descriptor ?? null);
    const startKey =
      activeIdentity && !runtime.deferred ? `${runtime.executionMode}:${activeIdentity}` : null;
    const diagnostics = options.diagnostics.getSnapshot();
    const patch: MutablePartial<ReturnType<MaterialCompositorDiagnosticsStore["getSnapshot"]>> = {
      executionMode: runtime.executionMode,
      lastRuntimeFailure: runtime.lastFailure,
    };
    if (startKey && startKey !== previousStartKey) {
      patch.expensiveBuildStarts = diagnostics.expensiveBuildStarts + 1;
    }
    if (acceptedIdentity && acceptedIdentity !== previousAcceptedIdentity) {
      patch.acceptedBuilds = diagnostics.acceptedBuilds + 1;
      patch.cacheAnchor = runtime.accepted?.descriptor.anchor ?? null;
    }
    if (
      previousActiveIdentity &&
      previousActiveIdentity !== activeIdentity &&
      previousActiveIdentity !== acceptedIdentity
    ) {
      patch.rejectedBuilds = diagnostics.rejectedBuilds + 1;
    }
    previousActiveIdentity = activeIdentity;
    previousStartKey = startKey;
    previousAcceptedIdentity = acceptedIdentity;
    options.diagnostics.update(patch);
    if (presentation && options.surfaces.getSnapshot().surfaces.length > 0) {
      ensureCache(false);
      scheduleCompose(presentation.viewport);
    }
  };

  const requestCache = () => {
    if (!presentation || !quality) return;
    if (presentation.sceneKey !== lastSceneKey) {
      lifecycleEpoch += 1;
      buildSerial = 0;
      lastSceneKey = presentation.sceneKey;
    }
    buildSerial += 1;
    const { descriptor, scene } = createMaterialCacheBuild(
      presentation,
      quality,
      lifecycleEpoch,
      buildSerial,
    );
    const diagnostics = options.diagnostics.getSnapshot();
    options.diagnostics.update({
      expensiveBuildRequests: diagnostics.expensiveBuildRequests + 1,
      scenePrimitiveCount: scene.primitives.length,
      sceneRevision: presentation.sceneRevision,
    });
    options.runtime.request(descriptor, scene);
  };

  const ensureCache = (force: boolean) => {
    if (!presentation || !quality) return;
    const runtime = options.runtime.getSnapshot();
    if (force && (runtime.scheduler.active || runtime.scheduler.queued)) force = false;
    const candidate = runtime.scheduler.desired ?? runtime.accepted?.descriptor ?? null;
    if (!force && candidate) {
      const coverage = evaluateDesiredMaterialCache(presentation, quality, candidate);
      if (!coverage) {
        requestCache();
        return;
      }
      options.diagnostics.update({ coverageReasons: coverage.reasons });
      if (!coverage.requiresRebuild) return;
    }
    requestCache();
  };

  const unsubscribeRuntime = options.runtime.subscribe(updateRuntimeDiagnostics);
  const unsubscribeSurfaces = options.surfaces.subscribe(() => {
    if (disposed) return;
    const snapshot = options.surfaces.getSnapshot();
    const count = snapshot.surfaces.length;
    options.diagnostics.update({
      registeredSurfaces: {
        base: snapshot.surfaces.filter((surface) => surface.plane === "base").length,
        modal: snapshot.surfaces.filter((surface) => surface.plane === "modal").length,
      },
    });
    if (presentation && count > 0 && previousSurfaceCount === 0) {
      ensureCache(!options.runtime.getSnapshot().accepted);
    }
    previousSurfaceCount = count;
    if (presentation && !composing) scheduleCompose(presentation.viewport);
  });

  return Object.freeze({
    updatePresentation(next: MaterialBackdropPresentation | null) {
      if (disposed) return;
      presentation = next;
      if (!next) {
        options.outputs.clear();
        return;
      }
      options.runtime.setInteractionActive(next.interactionActive);
      const nextQuality = calculateAdaptiveQuality({
        viewportWidthCssPx: next.viewport.screen.width,
        viewportHeightCssPx: next.viewport.screen.height,
      });
      const resized =
        !quality || !canvasSizesEqual(quality.viewportCssSize, nextQuality.viewportCssSize);
      quality = nextQuality;
      if (resized) {
        options.outputs.resize(nextQuality.viewportCssSize, nextQuality.compositorBackingSize);
        renderedPlaneRevisions = { base: -1, modal: -1 };
      }
      options.diagnostics.update({ viewport: next.viewport, sceneRevision: next.sceneRevision });
      const hasSurfaces = options.surfaces.getSnapshot().surfaces.length > 0;
      if (hasSurfaces) {
        ensureCache(false);
        scheduleCompose(next.viewport);
      }
    },
    notifySurfaceGeometryChanged() {
      if (disposed || !presentation || options.surfaces.getSnapshot().surfaces.length === 0) return;
      scheduleCompose(presentation.viewport);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      unsubscribeRuntime();
      unsubscribeSurfaces();
      if (frameHandle !== null) options.frames.cancel(frameHandle);
      frameState = disposeComposeFrames(frameState);
      options.outputs.dispose();
    },
  });
}

type MutablePartial<Value> = {
  -readonly [Key in keyof Value]?: Value[Key];
};
