export const CANVAS_BROWSER_WHEEL_DELTA_SCALE = 0.45;

export function convertCanvasBrowserWheelDelta(
  deltaY: number,
  deltaMode: number,
  viewportHeight: number,
) {
  const pixels = deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * viewportHeight : deltaY;
  return pixels * CANVAS_BROWSER_WHEEL_DELTA_SCALE;
}
