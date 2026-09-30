import { easeOutCubic, type PresenceTiming } from "../../motion/presenceMotion";
import { MOTION_DURATION_MS } from "../../motion/motionTokens";

const smoothstep = (progress: number) => progress * progress * (3 - 2 * progress);

/** Retained accepted modal timing: normal ease-out enter, fast smoothstep exit. */
export const MODAL_PRESENCE_TIMING = Object.freeze({
  enter: { durationMs: MOTION_DURATION_MS.normal, easing: easeOutCubic } satisfies PresenceTiming,
  exit: { durationMs: MOTION_DURATION_MS.fast, easing: smoothstep } satisfies PresenceTiming,
});
