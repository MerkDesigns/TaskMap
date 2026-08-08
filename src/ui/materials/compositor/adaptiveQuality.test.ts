// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  CACHE_PIXEL_BUDGET,
  COMPOSITOR_PIXEL_BUDGET,
  MANUAL_REFERENCE_SCALE,
  MARGIN_MULTIPLIER,
  MAX_CACHE_SCALE,
  MAX_COMPOSITE_SCALE,
  MIN_CACHE_SCALE,
  MIN_COMPOSITE_SCALE,
  calculateAdaptiveQuality,
} from "./adaptiveQuality";

describe("adaptive compositor quality", () => {
  it("exports the exact normative initial constants", () => {
    expect({
      CACHE_PIXEL_BUDGET,
      COMPOSITOR_PIXEL_BUDGET,
      MIN_CACHE_SCALE,
      MAX_CACHE_SCALE,
      MIN_COMPOSITE_SCALE,
      MAX_COMPOSITE_SCALE,
      MANUAL_REFERENCE_SCALE,
      MARGIN_MULTIPLIER,
    }).toEqual({
      CACHE_PIXEL_BUDGET: 1_000_000,
      COMPOSITOR_PIXEL_BUDGET: 600_000,
      MIN_CACHE_SCALE: 0.16,
      MAX_CACHE_SCALE: 0.7,
      MIN_COMPOSITE_SCALE: 0.2,
      MAX_COMPOSITE_SCALE: 0.72,
      MANUAL_REFERENCE_SCALE: 0.5,
      MARGIN_MULTIPLIER: 1,
    });
  });

  it("applies the normative formulas without a device-pixel-ratio factor", () => {
    const quality = calculateAdaptiveQuality({
      viewportWidthCssPx: 1920,
      viewportHeightCssPx: 1080,
    });
    const expectedMargin = 1080 * 0.35;
    const expectedCacheWidth = 1920 + expectedMargin * 2;
    const expectedCacheHeight = 1080 + expectedMargin * 2;

    expect(quality.marginCssPx).toBe(expectedMargin);
    expect(quality.cacheCssSize).toEqual({
      width: expectedCacheWidth,
      height: expectedCacheHeight,
    });
    expect(quality.cacheScale).toBeCloseTo(
      Math.sqrt(CACHE_PIXEL_BUDGET / (expectedCacheWidth * expectedCacheHeight)),
      12,
    );
    expect(quality.compositeScale).toBeCloseTo(
      Math.sqrt(COMPOSITOR_PIXEL_BUDGET / (1920 * 1080)),
      12,
    );
  });

  it("clamps cache and compositor scales at both ends", () => {
    const tiny = calculateAdaptiveQuality({ viewportWidthCssPx: 100, viewportHeightCssPx: 100 });
    const large = calculateAdaptiveQuality({
      viewportWidthCssPx: 10_000,
      viewportHeightCssPx: 8_000,
    });

    expect(tiny.cacheScale).toBe(MAX_CACHE_SCALE);
    expect(tiny.compositeScale).toBe(MAX_COMPOSITE_SCALE);
    expect(large.cacheScale).toBe(MIN_CACHE_SCALE);
    expect(large.compositeScale).toBe(MIN_COMPOSITE_SCALE);
  });

  it("clamps the base margin at minimum, formula, and maximum cases", () => {
    expect(
      calculateAdaptiveQuality({ viewportWidthCssPx: 400, viewportHeightCssPx: 300 })
        .baseMarginCssPx,
    ).toBe(240);
    expect(
      calculateAdaptiveQuality({ viewportWidthCssPx: 1200, viewportHeightCssPx: 800 })
        .baseMarginCssPx,
    ).toBe(280);
    expect(
      calculateAdaptiveQuality({ viewportWidthCssPx: 4000, viewportHeightCssPx: 3000 })
        .baseMarginCssPx,
    ).toBe(900);
  });

  it("applies the fixed normative margin multiplier", () => {
    const quality = calculateAdaptiveQuality({
      viewportWidthCssPx: 1200,
      viewportHeightCssPx: 800,
    });
    expect(quality.baseMarginCssPx).toBe(280);
    expect(quality.marginMultiplier).toBe(1);
    expect(quality.marginCssPx).toBe(280);
    expect(MARGIN_MULTIPLIER).toBe(1);
  });

  it("ceil-rounds backing dimensions so fractional scaling never under-allocates", () => {
    const quality = calculateAdaptiveQuality({
      viewportWidthCssPx: 1001,
      viewportHeightCssPx: 777,
    });
    expect(quality.cacheBackingSize).toEqual({
      width: Math.ceil(quality.cacheCssSize.width * quality.cacheScale),
      height: Math.ceil(quality.cacheCssSize.height * quality.cacheScale),
    });
    expect(quality.compositorBackingSize).toEqual({
      width: Math.ceil(1001 * quality.compositeScale),
      height: Math.ceil(777 * quality.compositeScale),
    });
  });

  it.each([
    { viewportWidthCssPx: 0, viewportHeightCssPx: 100 },
    { viewportWidthCssPx: -1, viewportHeightCssPx: 100 },
    { viewportWidthCssPx: Number.NaN, viewportHeightCssPx: 100 },
    { viewportWidthCssPx: 100, viewportHeightCssPx: Infinity },
  ])("rejects invalid dimensions deliberately", (input) => {
    expect(() => calculateAdaptiveQuality(input)).toThrow(RangeError);
  });
});
