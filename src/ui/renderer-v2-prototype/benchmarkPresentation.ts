import type { CanvasViewport } from "../../canvas/geometry/viewportMath";
import type { BenchmarkElementModel } from "./benchmarkTypes";
import type { LiquidCaptureAttributionSnapshot } from "./liquidCaptureAttribution";
import type { LiquidFrameWakeSnapshot } from "./liquidFrameWakeMetrics";
import type { PrototypeFrameSchedulerSnapshot } from "./prototypeFrameSchedulerMetrics";

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
  syncElement(element: BenchmarkElementModel): void;
  tick(now: number): void;
  getLiquidCounts(): BenchmarkLiquidCounts;
  resetLiquidCounts(): void;
  needsFrame(): boolean;
  setFrameRequestListener(
    listener: ((reason: "capture-completion" | "mutation") => boolean) | null,
  ): void;
}
