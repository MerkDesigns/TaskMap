import type { CanvasSize } from "../../../canvas/geometry/canvasGeometry";

export const CACHE_PIXEL_BUDGET = 1_000_000;
export const COMPOSITOR_PIXEL_BUDGET = 600_000;

export const MIN_CACHE_SCALE = 0.16;
export const MAX_CACHE_SCALE = 0.7;

export const MIN_COMPOSITE_SCALE = 0.2;
export const MAX_COMPOSITE_SCALE = 0.72;

export const MANUAL_REFERENCE_SCALE = 0.5;
export const MARGIN_MULTIPLIER = 1;

export interface AdaptiveQualityInput {
  readonly viewportWidthCssPx: number;
  readonly viewportHeightCssPx: number;
}

export interface AdaptiveQuality {
  readonly viewportCssSize: CanvasSize;
  readonly baseMarginCssPx: number;
  readonly marginMultiplier: number;
  readonly marginCssPx: number;
  readonly cacheScale: number;
  readonly compositeScale: number;
  readonly cacheCssSize: CanvasSize;
  readonly cacheBackingSize: CanvasSize;
  readonly compositorBackingSize: CanvasSize;
}

export function calculateAdaptiveQuality(input: AdaptiveQualityInput): AdaptiveQuality {
  const width = requirePositiveFinite(input.viewportWidthCssPx, "viewportWidthCssPx");
  const height = requirePositiveFinite(input.viewportHeightCssPx, "viewportHeightCssPx");
  const baseMarginCssPx = clamp(Math.min(width, height) * 0.35, 240, 900);
  const marginCssPx = baseMarginCssPx * MARGIN_MULTIPLIER;
  const cacheCssSize = size(width + marginCssPx * 2, height + marginCssPx * 2);
  const cacheScale = clamp(
    Math.sqrt(CACHE_PIXEL_BUDGET / (cacheCssSize.width * cacheCssSize.height)),
    MIN_CACHE_SCALE,
    MAX_CACHE_SCALE,
  );
  const compositeScale = clamp(
    Math.sqrt(COMPOSITOR_PIXEL_BUDGET / (width * height)),
    MIN_COMPOSITE_SCALE,
    MAX_COMPOSITE_SCALE,
  );

  return Object.freeze({
    viewportCssSize: size(width, height),
    baseMarginCssPx,
    marginMultiplier: MARGIN_MULTIPLIER,
    marginCssPx,
    cacheScale,
    compositeScale,
    cacheCssSize,
    cacheBackingSize: backingSize(cacheCssSize, cacheScale),
    compositorBackingSize: backingSize(size(width, height), compositeScale),
  });
}

function backingSize(cssSize: CanvasSize, scale: number): CanvasSize {
  return size(
    Math.max(1, Math.ceil(cssSize.width * scale)),
    Math.max(1, Math.ceil(cssSize.height * scale)),
  );
}

function size(width: number, height: number): CanvasSize {
  return Object.freeze({ width, height });
}

function requirePositiveFinite(value: number, name: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number`);
  }
  return value;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
