import type { CanvasViewport } from "../../../canvas/geometry/viewportMath";

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
  canvasCardOrder: number[];
  activeCanvasCardId: number;
  camera: CanvasViewport;
  animations: BenchmarkAnimationSettings;
}

export interface BenchmarkSceneCounts {
  textCards: number;
  containers: number;
  canvasCards: number;
  elements: number;
}
