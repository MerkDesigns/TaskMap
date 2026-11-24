import { clampZoom, quantizeZoom, wheelZoomSteps, zoomAfterWheelSteps } from "../../canvasMath";
import type { CanvasPoint } from "../../canvas/geometry/canvasGeometry";
import type { PanGestureFrameScheduler } from "./panGestureFrameQueue";

/** The glide lands on its target once the zoom is within this factor of it (log space). */
const SETTLE_LOG_DISTANCE = 0.002;
/** A frame gap longer than this (a stall, a hidden window) advances the glide no further. */
const MAX_FRAME_MS = 50;

export interface WheelZoomGlidePorts {
  readonly scheduler: PanGestureFrameScheduler;
  readonly now: () => number;
  readonly zoom: () => number;
  /** Shows the camera at `zoom` around the screen anchor. */
  readonly apply: (zoom: number, anchor: CanvasPoint) => void;
  /** The glide reached its target; the camera is at rest. */
  readonly settled: () => void;
}

export interface WheelZoomGlide {
  /** Adds one wheel event's steps to the target and glides there over `timeConstantMs`. */
  readonly wheel: (anchor: CanvasPoint, deltaY: number, timeConstantMs: number) => void;
  /** Stops where the camera is, e.g. when something else moves it. */
  readonly cancel: () => void;
  readonly gliding: () => boolean;
}

/**
 * Smooth wheel zoom: wheel steps move a target zoom, and each frame the camera covers a share of
 * the remaining distance (in log space, so zooming in and out feel the same), so a burst of
 * notches becomes one continuous motion that eases into the target. Targets stay on the
 * five-percent steps; only the frames between them use the zooms in between.
 */
export function createWheelZoomGlide(ports: WheelZoomGlidePorts): WheelZoomGlide {
  let frame: number | null = null;
  let unroundedTarget = 1;
  let target = 1;
  let anchor: CanvasPoint = { x: 0, y: 0 };
  let timeConstantMs = 1;
  let lastTime = 0;

  const cancel = () => {
    if (frame !== null) ports.scheduler.cancel(frame);
    frame = null;
  };

  const tick = () => {
    frame = null;
    const time = ports.now();
    const elapsed = Math.min(Math.max(0, time - lastTime), MAX_FRAME_MS);
    lastTime = time;
    const current = ports.zoom();
    const remaining = Math.log(target / current);
    const share = 1 - Math.exp(-elapsed / timeConstantMs);
    const next = current * Math.exp(remaining * share);
    if (Math.abs(Math.log(target / next)) <= SETTLE_LOG_DISTANCE) {
      ports.apply(target, anchor);
      ports.settled();
      return;
    }
    ports.apply(next, anchor);
    frame = ports.scheduler.schedule(tick);
  };

  return {
    wheel(nextAnchor, deltaY, nextTimeConstantMs) {
      const steps = wheelZoomSteps(deltaY);
      if (steps === 0) return;
      if (frame === null) {
        unroundedTarget = ports.zoom();
        lastTime = ports.now();
      }
      unroundedTarget = clampZoom(zoomAfterWheelSteps(unroundedTarget, steps));
      target = quantizeZoom(unroundedTarget);
      anchor = nextAnchor;
      timeConstantMs = Math.max(1, nextTimeConstantMs);
      if (frame === null) frame = ports.scheduler.schedule(tick);
    },
    cancel,
    gliding: () => frame !== null,
  };
}
