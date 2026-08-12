import type { CanvasPoint } from "../geometry/canvasGeometry";
import type { CanvasViewport } from "../geometry/viewportMath";

export interface CanvasCameraState {
  readonly pan: CanvasPoint;
  readonly zoom: number;
}

export interface CanvasCameraSession {
  get(canvasId: string): CanvasCameraState | undefined;
  set(canvasId: string, viewport: Pick<CanvasViewport, "pan" | "zoom">): void;
  delete(canvasId: string): void;
  retain(canvasIds: ReadonlySet<string>): void;
}

export function createCanvasCameraSession(): CanvasCameraSession {
  const cameras = new Map<string, CanvasCameraState>();
  return {
    get(canvasId) {
      return cameras.get(canvasId);
    },
    set(canvasId, viewport) {
      cameras.set(canvasId, {
        pan: { x: viewport.pan.x, y: viewport.pan.y },
        zoom: viewport.zoom,
      });
    },
    delete(canvasId) {
      cameras.delete(canvasId);
    },
    retain(canvasIds) {
      for (const canvasId of cameras.keys()) {
        if (!canvasIds.has(canvasId)) cameras.delete(canvasId);
      }
    },
  };
}
