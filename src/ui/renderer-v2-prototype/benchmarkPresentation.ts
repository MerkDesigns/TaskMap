import type { CanvasViewport } from "../../canvas/geometry/viewportMath";
// DEV/PROTOTYPE ONLY — benchmark instrumentation contracts.
import type { LiquidCaptureAttributionSnapshot } from "./dev/liquidCaptureAttribution";
import type { LiquidFrameWakeSnapshot } from "./dev/liquidFrameWakeMetrics";
import type { PrototypeFrameSchedulerSnapshot } from "./dev/prototypeFrameSchedulerMetrics";

export interface BenchmarkLiquidCounts
  extends
    LiquidCaptureAttributionSnapshot,
    LiquidFrameWakeSnapshot,
    PrototypeFrameSchedulerSnapshot {
  html: number;
  containers: number;
  glassShapes: number;
  cardGeometrySyncs: number;
  scrollGroupTransformUpdates: number;
  dragTransformUpdates: number;
  visibleCanvasCards: number;
  totalCanvasCards: number;
  rendererRenderCallsPerSecond: number;
  browserRuntimeTicksPerSecond: number;
  scrollGroupTransformUpdatesPerSecond: number;
  cardVisibilitySyncsPerSecond: number;
  captureAvailable: boolean;
}

export interface BenchmarkPresentation {
  presentCamera(viewport: CanvasViewport): void;
  tick(now: number): void;
  getLiquidCounts(): BenchmarkLiquidCounts;
  resetLiquidCounts(): void;
  needsFrame(): boolean;
  setFrameRequestListener(
    listener: ((reason: "capture-completion" | "mutation") => boolean) | null,
  ): void;
}
