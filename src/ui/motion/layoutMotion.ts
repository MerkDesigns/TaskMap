import type { MotionFrameScheduler } from "./motionFrameScheduler";
import { interpolate, normalizedProgress } from "./motionMath";
import { MOTION_DURATION_MS } from "./motionTokens";

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
  notifyGeometryChanged: () => void = noOp,
  onSettled: () => void = noOp,
): () => void {
  let active = true;
  const settle = () => {
    element.style.removeProperty("transform");
    element.style.removeProperty("transform-origin");
    element.style.removeProperty("will-change");
    notifyGeometryChanged();
    onSettled();
  };
  if (reducedMotion) {
    settle();
    return () => undefined;
  }
  const flip = calculateFlipTransform(first, last);
  if (
    Math.abs(flip.translateX) < 1 &&
    Math.abs(flip.translateY) < 1 &&
    Math.abs(flip.scaleX - 1) < 0.001 &&
    Math.abs(flip.scaleY - 1) < 0.001
  ) {
    settle();
    return () => undefined;
  }
  element.style.transformOrigin = "top left";
  element.style.willChange = "transform";
  element.style.transform = `translate3d(${flip.translateX}px, ${flip.translateY}px, 0) scale(${flip.scaleX}, ${flip.scaleY})`;
  notifyGeometryChanged();
  let elapsedMs = 0;
  const unsubscribe = scheduler.subscribe(({ deltaMs }) => {
    elapsedMs += deltaMs;
    const progress = normalizedProgress(elapsedMs, 0, MOTION_DURATION_MS.normal);
    const eased = 1 - Math.pow(1 - progress, 3);
    if (progress >= 1) {
      active = false;
      settle();
      return false;
    }
    element.style.transform = `translate3d(${interpolate(flip.translateX, 0, eased)}px, ${interpolate(flip.translateY, 0, eased)}px, 0) scale(${interpolate(flip.scaleX, 1, eased)}, ${interpolate(flip.scaleY, 1, eased)})`;
    notifyGeometryChanged();
    return true;
  });
  return () => {
    if (!active) return;
    active = false;
    unsubscribe();
    settle();
  };
}

const noOp = () => undefined;
