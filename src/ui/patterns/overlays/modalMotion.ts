import { easeOutCubic, type PresenceTiming } from "../../motion/presenceMotion";
import { MOTION_DURATION_MS } from "../../motion/motionTokens";

const smoothstep = (progress: number) => progress * progress * (3 - 2 * progress);

/**
 * Modal timing: ease-out enter, fast smoothstep exit. The enter is 20% slower than the retained
 * normal duration (user choice 2026-09-30, with the plain material fade).
 */
export const MODAL_PRESENCE_TIMING = Object.freeze({
  enter: {
    durationMs: MOTION_DURATION_MS.normal * 1.2,
    easing: easeOutCubic,
  } satisfies PresenceTiming,
  exit: { durationMs: MOTION_DURATION_MS.fast, easing: smoothstep } satisfies PresenceTiming,
});
