import type { CanvasViewport } from "../../canvas/geometry/viewportMath";
import type { CanvasBrowserItemId } from "./liquidCanvasBrowserTypes";

export type BenchmarkElementKind = "text-card" | "container";

export interface BenchmarkElementModel {
  id: string;
  kind: BenchmarkElementKind;
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
  ordinal: number;
}

export interface BenchmarkAnimationSettings {
  moveCards: boolean;
  moveImage: boolean;
  showGif: boolean;
}

export interface BenchmarkSceneModel {
  elements: BenchmarkElementModel[];
  canvasCardCount: number;
  canvasCardOrder: CanvasBrowserItemId[];
  activeCanvasCardId: CanvasBrowserItemId;
  camera: CanvasViewport;
  animations: BenchmarkAnimationSettings;
}

export interface BenchmarkSceneCounts {
  textCards: number;
  containers: number;
  canvasCards: number;
  elements: number;
}
