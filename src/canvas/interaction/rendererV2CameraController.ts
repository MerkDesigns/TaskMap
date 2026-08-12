import {
  createViewport,
  translateViewport,
  wheelZoomViewport,
  type CanvasViewport,
} from "../geometry/viewportMath";
import type { CanvasPoint, CanvasSize } from "../geometry/canvasGeometry";

export interface RendererV2CameraSnapshot {
  readonly viewport: CanvasViewport;
  readonly panning: boolean;
}

export interface CameraFrameScheduler {
  readonly request: (callback: () => void) => number;
  readonly cancel: (handle: number) => void;
}

export interface RendererV2CameraControllerOptions {
  readonly initialViewport: CanvasViewport;
  readonly frames: CameraFrameScheduler;
  readonly present: (snapshot: RendererV2CameraSnapshot) => void;
}

export interface RendererV2CameraController {
  readonly getSnapshot: () => RendererV2CameraSnapshot;
  readonly beginPan: (pointerId: number, screen: CanvasPoint) => boolean;
  readonly updatePan: (pointerId: number, screen: CanvasPoint) => void;
  readonly completePan: (pointerId: number) => void;
  readonly cancelPan: (pointerId: number) => void;
  readonly wheelZoom: (screenAnchor: CanvasPoint, deltaY: number) => void;
  readonly replaceViewport: (viewport: CanvasViewport) => void;
  readonly resize: (screen: CanvasSize) => void;
  readonly dispose: () => void;
}

interface PanGesture {
  readonly pointerId: number;
  readonly startingViewport: CanvasViewport;
  lastScreen: CanvasPoint;
}

export function createRendererV2CameraController({
  initialViewport,
  frames,
  present,
}: RendererV2CameraControllerOptions): RendererV2CameraController {
  let viewport = initialViewport;
  let pan: PanGesture | null = null;
  let frame: number | null = null;
  let disposed = false;

  const getSnapshot = (): RendererV2CameraSnapshot => ({ viewport, panning: pan !== null });
  const schedulePresentation = () => {
    if (disposed || frame !== null) return;
    frame = frames.request(() => {
      frame = null;
      if (!disposed) present(getSnapshot());
    });
  };

  return {
    getSnapshot,
    beginPan(pointerId, screen) {
      if (disposed || pan) return false;
      pan = { pointerId, startingViewport: viewport, lastScreen: screen };
      schedulePresentation();
      return true;
    },
    updatePan(pointerId, screen) {
      if (disposed || pan?.pointerId !== pointerId) return;
      viewport = translateViewport(viewport, {
        x: screen.x - pan.lastScreen.x,
        y: screen.y - pan.lastScreen.y,
      });
      pan.lastScreen = screen;
      schedulePresentation();
    },
    completePan(pointerId) {
      if (disposed || pan?.pointerId !== pointerId) return;
      pan = null;
      schedulePresentation();
    },
    cancelPan(pointerId) {
      if (disposed || pan?.pointerId !== pointerId) return;
      viewport = pan.startingViewport;
      pan = null;
      schedulePresentation();
    },
    wheelZoom(screenAnchor, deltaY) {
      if (disposed) return;
      viewport = wheelZoomViewport(viewport, screenAnchor, deltaY);
      schedulePresentation();
    },
    replaceViewport(nextViewport) {
      if (disposed) return;
      pan = null;
      viewport = createViewport(nextViewport.pan, nextViewport.zoom, nextViewport.screen);
      schedulePresentation();
    },
    resize(screen) {
      if (disposed) return;
      viewport = createViewport(viewport.pan, viewport.zoom, screen);
      schedulePresentation();
    },
    dispose() {
      disposed = true;
      pan = null;
      if (frame !== null) frames.cancel(frame);
      frame = null;
    },
  };
}
