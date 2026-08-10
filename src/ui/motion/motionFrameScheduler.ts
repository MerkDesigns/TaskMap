import { MOTION_DEFAULT_FRAME_DELTA_MS, MOTION_MAX_FRAME_DELTA_MS } from "./motionTokens";

export interface MotionFrame {
  readonly timestampMs: number;
  readonly deltaMs: number;
}

export type MotionFrameSubscriber = (frame: MotionFrame) => boolean;

export interface MotionFrameDriver {
  request(callback: (timestampMs: number) => void): number;
  cancel(handle: number): void;
}

export interface MotionFrameSchedulerSnapshot {
  readonly subscriberCount: number;
  readonly framePending: boolean;
}

export interface MotionFrameScheduler {
  subscribe(subscriber: MotionFrameSubscriber): () => void;
  getSnapshot(): MotionFrameSchedulerSnapshot;
  dispose(): void;
}

export function createMotionFrameScheduler(driver: MotionFrameDriver): MotionFrameScheduler {
  let disposed = false;
  let frameHandle: number | null = null;
  let previousTimestamp: number | null = null;
  const subscribers = new Set<MotionFrameSubscriber>();

  const schedule = () => {
    if (disposed || frameHandle !== null || subscribers.size === 0) return;
    frameHandle = driver.request(runFrame);
  };

  const runFrame = (timestampMs: number) => {
    frameHandle = null;
    if (disposed) return;
    const rawDelta =
      previousTimestamp === null ? MOTION_DEFAULT_FRAME_DELTA_MS : timestampMs - previousTimestamp;
    previousTimestamp = timestampMs;
    const deltaMs = Math.max(0, Math.min(MOTION_MAX_FRAME_DELTA_MS, rawDelta));
    const frame = Object.freeze({ timestampMs, deltaMs });
    for (const subscriber of [...subscribers]) {
      if (!subscriber(frame)) subscribers.delete(subscriber);
    }
    if (subscribers.size === 0) previousTimestamp = null;
    else schedule();
  };

  return Object.freeze({
    subscribe(subscriber: MotionFrameSubscriber) {
      if (disposed) return () => undefined;
      subscribers.add(subscriber);
      schedule();
      let active = true;
      return () => {
        if (!active) return;
        active = false;
        subscribers.delete(subscriber);
        if (subscribers.size === 0) {
          previousTimestamp = null;
          if (frameHandle !== null) driver.cancel(frameHandle);
          frameHandle = null;
        }
      };
    },
    getSnapshot: () =>
      Object.freeze({ subscriberCount: subscribers.size, framePending: frameHandle !== null }),
    dispose() {
      if (disposed) return;
      disposed = true;
      if (frameHandle !== null) driver.cancel(frameHandle);
      frameHandle = null;
      previousTimestamp = null;
      subscribers.clear();
    },
  });
}

let sharedScheduler: MotionFrameScheduler | null = null;

export function getSharedMotionFrameScheduler(): MotionFrameScheduler {
  sharedScheduler ??= createMotionFrameScheduler({
    request: (callback) => window.requestAnimationFrame(callback),
    cancel: (handle) => window.cancelAnimationFrame(handle),
  });
  return sharedScheduler;
}
