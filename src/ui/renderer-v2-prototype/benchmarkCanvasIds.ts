import type { CanvasBrowserItemId } from "./liquidCanvasBrowserTypes";

const BENCHMARK_CANVAS_ID_PREFIX = "benchmark-canvas-";

export function benchmarkCanvasId(index: number): CanvasBrowserItemId {
  return `${BENCHMARK_CANVAS_ID_PREFIX}${index + 1}`;
}

export function benchmarkCanvasIndex(id: CanvasBrowserItemId) {
  const value = Number.parseInt(id.slice(BENCHMARK_CANVAS_ID_PREFIX.length), 10) - 1;
  return Number.isInteger(value) && value >= 0 ? value : -1;
}

export function benchmarkCanvasNumber(id: CanvasBrowserItemId) {
  return benchmarkCanvasIndex(id) + 1;
}
