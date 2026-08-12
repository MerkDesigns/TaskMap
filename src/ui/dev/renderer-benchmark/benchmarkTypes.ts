import type { CanvasViewport } from "../../../canvas/geometry/viewportMath";
import type { LiquidMaterialRole } from "../../materials/liquid-dom";

export type BenchmarkArchitecture = "A" | "B" | "C";
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

export interface BenchmarkGlassModel {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
  role: LiquidMaterialRole;
}

export interface BenchmarkAnimationSettings {
  moveCards: boolean;
  moveImage: boolean;
  showGif: boolean;
}

export interface BenchmarkSceneModel {
  architecture: BenchmarkArchitecture;
  elements: BenchmarkElementModel[];
  glasses: BenchmarkGlassModel[];
  camera: CanvasViewport;
  animations: BenchmarkAnimationSettings;
}

export interface BenchmarkSceneCounts {
  textCards: number;
  containers: number;
  glasses: number;
  elements: number;
}
