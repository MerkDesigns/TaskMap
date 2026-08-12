import type { CanvasViewport } from "../../../canvas/geometry/viewportMath";
import type { BenchmarkElementModel, BenchmarkGlassModel } from "./benchmarkTypes";

export interface BenchmarkLiquidCounts {
  html: number;
  containers: number;
  captureAvailable: boolean;
}

export interface BenchmarkPresentation {
  presentCamera(viewport: CanvasViewport): void;
  syncElement(element: BenchmarkElementModel): void;
  syncGlass(glass: BenchmarkGlassModel): void;
  tick(now: number): void;
  getLiquidCounts(): BenchmarkLiquidCounts;
}
