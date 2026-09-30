import type { MotionFrameScheduler } from "./motionFrameScheduler";
import {
  clearMaterialPresenceProgress,
  writeMaterialPresenceProgress,
} from "../materials/materialPresence";
import { supplyMaterialPresentation } from "../materials/materialGeometryInvalidation";

/**
 * Independent presence channels (glass contract section 16). Each channel owns its value; one
 * controller drives them from a single progress (0 hidden → 1 visible).
 */
export interface PresenceChannels {
  /** Ordinary content opacity (`contentTargets`). */
  readonly fade?: boolean;
  /** Material presence: blur/tint/rim/shadow; never ancestor opacity (section 17). */
  readonly materialFade?: boolean;
  /** Offset while hidden, in px. */
  readonly slide?: { readonly x?: number; readonly y?: number };
  /** Downward offset while hidden, in px. */
  readonly lift?: number;
  /** Scale while hidden, e.g. 0.96. */
  readonly scale?: number;
}

export interface PresenceTiming {
  readonly durationMs: number;
  readonly easing: (progress: number) => number;
}

export type PresenceEndpoint = "visible" | "hidden";
export type PresencePhase = "visible" | "showing" | "hiding" | "hidden";

export interface PresenceMotionOptions {
  readonly scheduler: MotionFrameScheduler;
  readonly channels: PresenceChannels;
  readonly reducedMotion: boolean;
  readonly enter?: PresenceTiming;
  readonly exit?: PresenceTiming;
  readonly initialProgress?: number;
  readonly onProgress?: (progress: number) => void;
  readonly onComplete?: (endpoint: PresenceEndpoint) => void;
  readonly onTransformWrite?: (transform: string) => void;
  readonly contentTargets?: () => readonly HTMLElement[];
}

export interface PresenceMotionSnapshot {
  readonly progress: number;
  readonly target: number;
  readonly phase: PresencePhase;
}

export interface PresenceMotion {
  show(): void;
  hide(): void;
  reverse(): void;
  setProgress(progress: number): void;
  setChannels(channels: PresenceChannels): void;
  getSnapshot(): PresenceMotionSnapshot;
  destroy(): void;
}

export const easeOutCubic = (progress: number) => 1 - (1 - progress) ** 3;
const DEFAULT_TIMING: PresenceTiming = { durationMs: 420, easing: easeOutCubic };

export function createPresenceMotion(
  surface: HTMLElement,
  options: PresenceMotionOptions,
): PresenceMotion {
  let channels = options.channels;
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
    if (channels.materialFade) {
      if (progress === 1) clearMaterialPresenceProgress(surface);
      else writeMaterialPresenceProgress(surface, progress);
    }
    if (channels.fade) {
      for (const content of options.contentTargets?.() ?? []) {
        content.style.opacity = progress === 1 ? "" : String(progress);
      }
    }
    const movement = presenceMovement(channels, progress);
    if (movement) {
      surface.style.transform = movement.transform;
      options.onTransformWrite?.(movement.transform);
    }
    // Shared material planes project the same presentation without layout reads.
    supplyMaterialPresentation(surface, {
      opacity: channels.materialFade ? progress : 1,
      translateX: movement?.x ?? 0,
      translateY: movement?.y ?? 0,
      scale: movement?.scale ?? 1,
    });
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

    const timing = (opening ? options.enter : options.exit) ?? DEFAULT_TIMING;
    const segmentDurationMs = Math.max(1, timing.durationMs * distance);
    let elapsedMs = 0;
    unsubscribe = options.scheduler.subscribe(({ deltaMs }) => {
      elapsedMs += deltaMs;
      const time = Math.min(1, elapsedMs / segmentDurationMs);
      write(from + (target - from) * timing.easing(time));
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
    setChannels(nextChannels) {
      if (destroyed) return;
      resetChannels(surface, channels, options.contentTargets);
      channels = nextChannels;
      write(progress);
    },
    getSnapshot: () => Object.freeze({ progress, target, phase }),
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stop();
      resetChannels(surface, channels, options.contentTargets);
      supplyMaterialPresentation(surface, { opacity: 1, translateX: 0, translateY: 0, scale: 1 });
      surface.style.pointerEvents = "";
      surface.inert = false;
      surface.removeAttribute("aria-hidden");
      delete surface.dataset.presencePhase;
      delete surface.dataset.presenceProgress;
    },
  };
}

interface PresenceMovement {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
  readonly transform: string;
}

function presenceMovement(channels: PresenceChannels, progress: number): PresenceMovement | null {
  if (!channels.slide && channels.lift === undefined && channels.scale === undefined) return null;
  const hidden = 1 - progress;
  const x = (channels.slide?.x ?? 0) * hidden;
  const y = ((channels.slide?.y ?? 0) + (channels.lift ?? 0)) * hidden;
  const scale = 1 + ((channels.scale ?? 1) - 1) * hidden;
  const translated = Math.abs(x) >= 0.001 || Math.abs(y) >= 0.001;
  const scaled = Math.abs(scale - 1) >= 0.0001;
  const transform = [
    translated ? `translate3d(${x}px, ${y}px, 0)` : "",
    scaled ? `scale(${scale})` : "",
  ]
    .filter(Boolean)
    .join(" ");
  return { x, y, scale, transform };
}

function resetChannels(
  surface: HTMLElement,
  channels: PresenceChannels,
  contentTargets: (() => readonly HTMLElement[]) | undefined,
) {
  if (channels.materialFade) clearMaterialPresenceProgress(surface);
  if (channels.fade) for (const content of contentTargets?.() ?? []) content.style.opacity = "";
  if (presenceMovement(channels, 1)) surface.style.transform = "";
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
