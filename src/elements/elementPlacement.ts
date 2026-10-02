import type { CSSProperties } from "react";

export interface ElementGeometryView {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Places an element with the `translate` property on its own layer instead of left/top. WebView2
 * rounds an element's edges, and every nested border and text line, relative to where it is laid
 * out; at a fractional canvas position a move or drop re-rounds them, so they shimmer or shift by a
 * pixel. Laid out at the origin and translated, the content rasterizes the same wherever it is.
 * `translate` composes with the enter/exit animations, which animate `transform`.
 */
export function placementStyle(shown: ElementGeometryView): CSSProperties {
  return {
    left: 0,
    top: 0,
    width: shown.width,
    height: shown.height,
    translate: `${shown.x}px ${shown.y}px`,
  };
}

/** Value comparison for renderer view state, which callers rebuild every render. */
export function shallowEqual(a: object, b: object) {
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every((key) => left[key] === right[key]);
}
