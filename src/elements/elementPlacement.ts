import type { CSSProperties } from "react";

export interface ElementGeometryView {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Lays an element out at its stored position and shows a gesture's live position as a GPU
 * translation. Re-laying it out at a fractional canvas position every frame makes WebView2 round
 * its edges, and every nested border, differently from frame to frame, so they shimmer; a
 * translated layer keeps its rasterized pixels. Size changes from a resize apply directly.
 */
export function placementStyle(
  stored: ElementGeometryView,
  shown: ElementGeometryView,
): CSSProperties {
  const dx = shown.x - stored.x;
  const dy = shown.y - stored.y;
  return {
    left: stored.x,
    top: stored.y,
    width: shown.width,
    height: shown.height,
    transform: dx || dy ? `translate3d(${dx}px, ${dy}px, 0)` : undefined,
  };
}

/** Value comparison for renderer view state, which callers rebuild every render. */
export function shallowEqual(a: object, b: object) {
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every((key) => left[key] === right[key]);
}
