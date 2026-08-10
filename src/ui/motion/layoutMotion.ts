import type { MotionFrameScheduler } from "./motionFrameScheduler";
import { MOTION_DURATION_MS, MOTION_EASING } from "./motionTokens";

export interface LayoutRectangle {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface FlipTransform {
  readonly translateX: number;
  readonly translateY: number;
  readonly scaleX: number;
  readonly scaleY: number;
}

export function calculateFlipTransform(
  first: LayoutRectangle,
  last: LayoutRectangle,
): FlipTransform {
  return Object.freeze({
    translateX: first.left - last.left,
    translateY: first.top - last.top,
    scaleX: last.width > 0 ? first.width / last.width : 1,
    scaleY: last.height > 0 ? first.height / last.height : 1,
  });
}

export function applyLocalFlip(
  element: HTMLElement,
  first: LayoutRectangle,
  last: LayoutRectangle,
  scheduler: MotionFrameScheduler,
  reducedMotion: boolean,
): () => void {
  if (reducedMotion) {
    element.style.removeProperty("transform");
    element.style.removeProperty("transition");
    return () => undefined;
  }
  const flip = calculateFlipTransform(first, last);
  element.style.transformOrigin = "top left";
  element.style.transition = "none";
  element.style.transform = `translate3d(${flip.translateX}px, ${flip.translateY}px, 0) scale(${flip.scaleX}, ${flip.scaleY})`;
  return scheduler.subscribe(() => {
    element.style.transition = `transform ${MOTION_DURATION_MS.normal}ms ${MOTION_EASING.emphasized}`;
    element.style.transform = "translate3d(0, 0, 0) scale(1, 1)";
    return false;
  });
}
