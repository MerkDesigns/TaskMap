import { MAX_ZOOM, MIN_ZOOM, ZOOM_STEP } from "./constants";

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function quantizeZoom(value: number) {
  return clamp(Math.round(value / ZOOM_STEP) * ZOOM_STEP, MIN_ZOOM, MAX_ZOOM);
}

export function getWheelZoom(currentZoom: number, deltaY: number) {
  const wheelNotch = 100;
  const rawSteps = -deltaY / wheelNotch;
  const direction = Math.sign(rawSteps);
  if (direction === 0) {
    return quantizeZoom(currentZoom);
  }

  const steps = direction * Math.min(4, Math.max(1, Math.abs(rawSteps)));
  return quantizeZoom(currentZoom * Math.pow(1 + ZOOM_STEP, steps));
}
