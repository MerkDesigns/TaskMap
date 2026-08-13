import type { CanvasViewport } from "../../canvas/geometry/viewportMath";
import type { BenchmarkElementModel } from "./benchmarkTypes";

export interface BenchmarkLiquidCounts {
  html: number;
  containers: number;
  glassShapes: number;
  cardGeometrySyncs: number;
  scrollGroupTransformUpdates: number;
  dragTransformUpdates: number;
  captureAvailable: boolean;
}

export interface BenchmarkPresentation {
  presentCamera(viewport: CanvasViewport): void;
  syncElement(element: BenchmarkElementModel): void;
  tick(now: number): void;
  getLiquidCounts(): BenchmarkLiquidCounts;
  resetLiquidCounts(): void;
}
