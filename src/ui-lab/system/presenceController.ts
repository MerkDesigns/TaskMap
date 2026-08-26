import type { MotionFrameScheduler } from "../../ui/motion/motionFrameScheduler";
import {
  clearMaterialPresenceProgress,
  writeMaterialPresenceProgress,
} from "../../ui/materials/materialPresence";

export type SlideDirection = "left" | "right";

export interface PresenceEffects {
  readonly fade?: true;
  readonly lift?: { readonly distancePx: number };
  readonly slide?: { readonly direction: SlideDirection; readonly distancePx: number };
}

export const Fade = Object.freeze({ fade: true } satisfies PresenceEffects);
export const Lift = Object.freeze({
  lift: Object.freeze({ distancePx: 10 }),
} satisfies PresenceEffects);
export const SlideLeft = Object.freeze({
  slide: Object.freeze({ direction: "left", distancePx: 18 }),
} satisfies PresenceEffects);
export const SlideRight = Object.freeze({
  slide: Object.freeze({ direction: "right", distancePx: 18 }),
} satisfies PresenceEffects);
export const FadeLift = Object.freeze({
  fade: true,
  lift: Object.freeze({ distancePx: 10 }),
} satisfies PresenceEffects);
export const FadeSlide = Object.freeze({
  fade: true,
  slide: Object.freeze({ direction: "right", distancePx: 18 }),
} satisfies PresenceEffects);

export type PresenceEndpoint = "visible" | "hidden";
export type PresencePhase = "visible" | "showing" | "hiding" | "hidden";

export interface PresenceControllerOptions {
  readonly scheduler: MotionFrameScheduler;
  readonly effects: PresenceEffects;
  readonly reducedMotion: boolean;
  readonly durationMs?: number;
  readonly initialProgress?: number;
  readonly onProgress?: (progress: number) => void;
  readonly onComplete?: (endpoint: PresenceEndpoint) => void;
  readonly onTransformWrite?: (transform: string) => void;
  readonly contentTargets?: () => readonly HTMLElement[];
}

export interface PresenceControllerSnapshot {
  readonly progress: number;
  readonly target: number;
  readonly phase: PresencePhase;
}

export interface PresenceController {
  show(): void;
  hide(): void;
  reverse(): void;
  setProgress(progress: number): void;
  getSnapshot(): PresenceControllerSnapshot;
  destroy(): void;
}

export function createPresenceController(
  surface: HTMLElement,
  options: PresenceControllerOptions,
): PresenceController {
  const durationMs = Math.max(1, options.durationMs ?? 420);
  let progress = clampProgress(options.initialProgress ?? 1);
  let target = progress;
  let phase: PresencePhase = progress === 0 ? "hidden" : progress === 1 ? "visible" : "showing";
  let unsubscribe: (() => void) | null = null;
  let destroyed = false;

  const stop = () => {
    unsubscribe?.();
    unsubscribe = null;
  };

  const write = (nextProgress: number) => {
    progress = clampProgress(nextProgress);
    if (options.effects.fade) {
      if (progress === 1) clearMaterialPresenceProgress(surface);
      else writeMaterialPresenceProgress(surface, progress);
      writeContentProgress(options.contentTargets?.() ?? [], progress);
    }
    writeMovement(surface, progress, options.effects, options.onTransformWrite);
    surface.dataset.presenceProgress = progress.toFixed(3);
    options.onProgress?.(progress);
  };

  const complete = (endpoint: PresenceEndpoint) => {
    phase = endpoint;
    surface.dataset.presencePhase = endpoint;
    setEndpointInteraction(surface, endpoint);
    options.onComplete?.(endpoint);
  };

  const animateTo = (nextTarget: number) => {
    if (destroyed) return;
    stop();
    target = clampProgress(nextTarget);
    const from = progress;
    const distance = Math.abs(target - from);
    const opening = target > from;
    phase = opening ? "showing" : "hiding";
    surface.dataset.presencePhase = phase;
    if (opening) setEndpointInteraction(surface, "visible");

    if (options.reducedMotion || distance < 0.0001) {
      write(target);
      complete(target === 0 ? "hidden" : "visible");
      return;
    }

    let elapsedMs = 0;
    const segmentDurationMs = durationMs * distance;
    unsubscribe = options.scheduler.subscribe(({ deltaMs }) => {
      elapsedMs += deltaMs;
      const time = Math.min(1, elapsedMs / segmentDurationMs);
      const eased = 1 - Math.pow(1 - time, 3);
      write(from + (target - from) * eased);
      if (time < 1) return true;
      unsubscribe = null;
      complete(target === 0 ? "hidden" : "visible");
      return false;
    });
  };

  write(progress);
  surface.dataset.presencePhase = phase;
  setEndpointInteraction(surface, progress === 0 ? "hidden" : "visible");

  return {
    show: () => animateTo(1),
    hide: () => animateTo(0),
    reverse: () => animateTo(target >= 0.5 ? 0 : 1),
    setProgress(nextProgress) {
      if (destroyed) return;
      stop();
      target = clampProgress(nextProgress);
      write(target);
      if (target === 0 || target === 1) complete(target === 0 ? "hidden" : "visible");
      else {
        phase = "showing";
        surface.dataset.presencePhase = "showing";
        setEndpointInteraction(surface, "visible");
      }
    },
    getSnapshot: () => Object.freeze({ progress, target, phase }),
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stop();
      if (options.effects.fade) clearMaterialPresenceProgress(surface);
      for (const content of options.contentTargets?.() ?? []) content.style.opacity = "";
      if (options.effects.lift || options.effects.slide) surface.style.transform = "";
      surface.style.pointerEvents = "";
      surface.inert = false;
      surface.removeAttribute("aria-hidden");
      delete surface.dataset.presencePhase;
      delete surface.dataset.presenceProgress;
    },
  };
}

function writeContentProgress(targets: readonly HTMLElement[], progress: number): void {
  for (const target of targets) target.style.opacity = progress === 1 ? "" : String(progress);
}

function writeMovement(
  surface: HTMLElement,
  progress: number,
  effects: PresenceEffects,
  onTransformWrite: ((transform: string) => void) | undefined,
): void {
  if (!effects.lift && !effects.slide) return;

  const hidden = 1 - progress;
  const translateY = (effects.lift?.distancePx ?? 0) * hidden;
  const slideDirection = effects.slide?.direction === "left" ? -1 : 1;
  const translateX = (effects.slide?.distancePx ?? 0) * hidden * slideDirection;
  const transform =
    Math.abs(translateX) < 0.001 && Math.abs(translateY) < 0.001
      ? ""
      : `translate3d(${translateX}px, ${translateY}px, 0)`;
  surface.style.transform = transform;
  onTransformWrite?.(transform);
}

function setEndpointInteraction(surface: HTMLElement, endpoint: PresenceEndpoint): void {
  const hidden = endpoint === "hidden";
  surface.inert = hidden;
  surface.style.pointerEvents = hidden ? "none" : "";
  if (hidden) {
    surface.setAttribute("aria-hidden", "true");
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement && surface.contains(activeElement))
      activeElement.blur();
  } else {
    surface.removeAttribute("aria-hidden");
  }
}

function clampProgress(progress: number): number {
  if (!Number.isFinite(progress)) return 0;
  return Math.min(1, Math.max(0, progress));
}
