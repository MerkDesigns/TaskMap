import { MAX_ZOOM, MIN_ZOOM, ZOOM_STEP } from "./constants";

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function quantizeZoom(value: number) {
  return clamp(Math.round(value / ZOOM_STEP) * ZOOM_STEP, MIN_ZOOM, MAX_ZOOM);
}
