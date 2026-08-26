export interface PresenceProgressTarget {
  readPresenceProgress(): number;
  writePresenceProgress(progress: number, translateY: number): void;
}

export interface PresenceMotionOptions {
  readonly durationMs?: number;
  readonly slideDistancePx?: number;
  readonly onProgress?: (progress: number) => void;
}

export interface PresenceMotionController {
  show(): void;
  hide(): void;
  reverse(): void;
  setProgress(progress: number): void;
  destroy(): void;
}

interface FrameScheduler {
  now(): number;
  request(callback: FrameRequestCallback): number;
  cancel(handle: number): void;
}

export function createPresenceMotionController(
  target: PresenceProgressTarget,
  options: PresenceMotionOptions = {},
  scheduler: FrameScheduler = browserFrameScheduler,
): PresenceMotionController {
  const durationMs = Math.max(1, options.durationMs ?? 520);
  const slideDistancePx = options.slideDistancePx ?? 12;
  let frameHandle: number | null = null;
  let targetProgress = target.readPresenceProgress();

  const write = (progress: number) => {
    const nextProgress = clampProgress(progress);
    target.writePresenceProgress(nextProgress, (1 - nextProgress) * slideDistancePx);
    options.onProgress?.(nextProgress);
  };

  const cancel = () => {
    if (frameHandle === null) return;
    scheduler.cancel(frameHandle);
    frameHandle = null;
  };

  const animateTo = (nextTarget: number) => {
    cancel();
    const from = target.readPresenceProgress();
    targetProgress = clampProgress(nextTarget);
    const distance = Math.abs(targetProgress - from);
    if (distance < 0.0001) {
      write(targetProgress);
      return;
    }

    const startedAt = scheduler.now();
    const segmentDuration = Math.max(1, durationMs * distance);
    const tick: FrameRequestCallback = (timestamp) => {
      const elapsed = Math.max(0, timestamp - startedAt);
      const time = Math.min(1, elapsed / segmentDuration);
      const eased = 1 - Math.pow(1 - time, 3);
      write(from + (targetProgress - from) * eased);
      if (time < 1) frameHandle = scheduler.request(tick);
      else frameHandle = null;
    };
    frameHandle = scheduler.request(tick);
  };

  return {
    show: () => animateTo(1),
    hide: () => animateTo(0),
    reverse: () => animateTo(targetProgress >= 0.5 ? 0 : 1),
    setProgress(progress) {
      cancel();
      targetProgress = clampProgress(progress);
      write(targetProgress);
    },
    destroy: cancel,
  };
}

const browserFrameScheduler: FrameScheduler = {
  now: () => performance.now(),
  request: (callback) => requestAnimationFrame(callback),
  cancel: (handle) => cancelAnimationFrame(handle),
};

function clampProgress(progress: number): number {
  if (!Number.isFinite(progress)) return 0;
  return Math.min(1, Math.max(0, progress));
}
