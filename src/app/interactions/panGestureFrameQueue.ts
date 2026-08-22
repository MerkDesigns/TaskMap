import { createViewport, type CanvasViewport } from "../../canvas/geometry/viewportMath";
import type { CanvasPoint, CanvasSize } from "../../canvas/geometry/canvasGeometry";

export interface PanGestureFrameState {
  startingViewport: CanvasViewport;
  startScreen: CanvasPoint;
  latestScreen: CanvasPoint;
}

export interface PanGestureFrameScheduler {
  readonly schedule: (callback: () => void) => number;
  readonly cancel: (handle: number) => void;
}

export function createPanGestureFrameQueue<T extends PanGestureFrameState>(
  scheduler: PanGestureFrameScheduler | undefined,
  publish: (pan: T) => void,
) {
  let frame: number | null = null;
  let latest: T | null = null;

  const cancel = () => {
    if (frame !== null) scheduler?.cancel(frame);
    frame = null;
    latest = null;
  };
  const flush = (pan: T) => {
    cancel();
    publish(pan);
  };
  const queue = (pan: T) => {
    latest = pan;
    if (!scheduler) {
      flush(pan);
      return;
    }
    if (frame !== null) return;
    frame = scheduler.schedule(() => {
      frame = null;
      const pending = latest;
      latest = null;
      if (pending) publish(pending);
    });
  };

  return { cancel, flush, queue };
}

export function projectPanViewport(pan: PanGestureFrameState, screen: CanvasSize): CanvasViewport {
  return createViewport(
    {
      x: pan.startingViewport.pan.x + pan.latestScreen.x - pan.startScreen.x,
      y: pan.startingViewport.pan.y + pan.latestScreen.y - pan.startScreen.y,
    },
    pan.startingViewport.zoom,
    screen,
  );
}

export function updatePanViewport(
  pan: PanGestureFrameState,
  screen: CanvasSize,
  update: (viewport: CanvasViewport) => CanvasViewport,
): CanvasViewport {
  const viewport = update(projectPanViewport(pan, screen));
  pan.startingViewport = viewport;
  pan.startScreen = pan.latestScreen;
  return viewport;
}
