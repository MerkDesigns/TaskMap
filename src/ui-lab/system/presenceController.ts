import type { MotionFrameScheduler } from "../../ui/motion/motionFrameScheduler";
import {
  createPresenceMotion,
  easeOutCubic,
  type PresenceChannels,
  type PresenceEndpoint,
  type PresenceMotion,
  type PresenceMotionSnapshot,
  type PresencePhase,
} from "../../ui/motion/presenceMotion";

export type { PresenceEndpoint, PresencePhase };

/** UI Lab presence vocabulary; the production controller in `ui/motion` does the work. */
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

export type PresenceControllerSnapshot = PresenceMotionSnapshot;
export type PresenceController = Omit<PresenceMotion, "setChannels">;

export function presenceChannels(effects: PresenceEffects): PresenceChannels {
  return {
    fade: effects.fade,
    materialFade: effects.fade,
    lift: effects.lift?.distancePx,
    slide: effects.slide && {
      x: (effects.slide.direction === "left" ? -1 : 1) * effects.slide.distancePx,
    },
  };
}

export function createPresenceController(
  surface: HTMLElement,
  { durationMs, effects, ...options }: PresenceControllerOptions,
): PresenceController {
  const timing = { durationMs: Math.max(1, durationMs ?? 420), easing: easeOutCubic };
  return createPresenceMotion(surface, {
    ...options,
    channels: presenceChannels(effects),
    enter: timing,
    exit: timing,
  });
}
