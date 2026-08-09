import type { CanvasViewport } from "../../canvas/geometry/viewportMath";
import type { CacheCoverageRebuildReason } from "./compositor/cacheCoverage";
import type { CacheBuildAnchor } from "./compositor/compositorTypes";
import type { AcrylicBuildFailureCode } from "./compositor/acrylicBuildExecutor";
import type { AcrylicExecutionMode } from "./compositor/compositorCapabilities";

export interface MaterialCompositorDiagnosticsSnapshot {
  readonly executionMode: AcrylicExecutionMode;
  readonly registeredSurfaces: Readonly<Record<"base" | "modal", number>>;
  readonly expensiveBuildRequests: number;
  readonly expensiveBuildStarts: number;
  readonly acceptedBuilds: number;
  readonly rejectedBuilds: number;
  readonly composeFrames: number;
  readonly maskRebuilds: Readonly<Record<"base" | "modal", number>>;
  readonly scenePrimitiveCount: number;
  readonly sceneRevision: number | null;
  readonly cacheAnchor: CacheBuildAnchor | null;
  readonly viewport: CanvasViewport | null;
  readonly coverageReasons: readonly CacheCoverageRebuildReason[];
  readonly lastRuntimeFailure: AcrylicBuildFailureCode | null;
}

export interface MaterialCompositorDiagnosticsStore {
  getSnapshot(): MaterialCompositorDiagnosticsSnapshot;
  update(patch: Partial<MaterialCompositorDiagnosticsSnapshot>): void;
  subscribe(listener: () => void): () => void;
}

export function createMaterialCompositorDiagnosticsStore(): MaterialCompositorDiagnosticsStore {
  let snapshot = freezeDiagnostics({
    executionMode: "overlay-only",
    registeredSurfaces: { base: 0, modal: 0 },
    expensiveBuildRequests: 0,
    expensiveBuildStarts: 0,
    acceptedBuilds: 0,
    rejectedBuilds: 0,
    composeFrames: 0,
    maskRebuilds: { base: 0, modal: 0 },
    scenePrimitiveCount: 0,
    sceneRevision: null,
    cacheAnchor: null,
    viewport: null,
    coverageReasons: [],
    lastRuntimeFailure: null,
  });
  const listeners = new Set<() => void>();

  return Object.freeze({
    getSnapshot: () => snapshot,
    update(patch: Partial<MaterialCompositorDiagnosticsSnapshot>) {
      snapshot = freezeDiagnostics({ ...snapshot, ...patch });
      listeners.forEach((listener) => listener());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });
}

function freezeDiagnostics(
  value: MaterialCompositorDiagnosticsSnapshot,
): MaterialCompositorDiagnosticsSnapshot {
  return Object.freeze({
    ...value,
    registeredSurfaces: Object.freeze({ ...value.registeredSurfaces }),
    maskRebuilds: Object.freeze({ ...value.maskRebuilds }),
    coverageReasons: Object.freeze([...value.coverageReasons]),
  });
}
