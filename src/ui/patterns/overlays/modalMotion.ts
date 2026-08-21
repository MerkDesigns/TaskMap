import { interpolate, normalizedProgress } from "../../motion/motionMath";
import { MOTION_DURATION_MS } from "../../motion/motionTokens";

export interface ModalMotionState {
  readonly opacity: number;
  readonly translateY: number;
  readonly scale: number;
  readonly scrimOpacity: number;
}

export const MODAL_ENTER_FROM = Object.freeze({
  opacity: 0,
  translateY: 6,
  scale: 0.98,
  scrimOpacity: 0,
});

export const MODAL_REST = Object.freeze({
  opacity: 1,
  translateY: 0,
  scale: 1,
  scrimOpacity: 1,
});

export const MODAL_EXIT_TO = Object.freeze({
  opacity: 0,
  translateY: 4,
  scale: 0.985,
  scrimOpacity: 0,
});

export function advanceModalMotion(
  from: ModalMotionState,
  opening: boolean,
  elapsedMs: number,
): { readonly state: ModalMotionState; readonly settled: boolean } {
  const durationMs = opening ? MOTION_DURATION_MS.normal : MOTION_DURATION_MS.fast;
  const progress = normalizedProgress(elapsedMs, 0, durationMs);
  const eased = opening ? 1 - Math.pow(1 - progress, 3) : progress * progress * (3 - 2 * progress);
  const target = opening ? MODAL_REST : MODAL_EXIT_TO;
  return Object.freeze({
    state:
      progress === 1
        ? target
        : Object.freeze({
            opacity: interpolate(from.opacity, target.opacity, eased),
            translateY: interpolate(from.translateY, target.translateY, eased),
            scale: interpolate(from.scale, target.scale, eased),
            scrimOpacity: interpolate(from.scrimOpacity, target.scrimOpacity, eased),
          }),
    settled: progress === 1,
  });
}
