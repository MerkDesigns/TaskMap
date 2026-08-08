// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createViewport } from "../../../canvas/geometry/viewportMath";
import {
  CACHE_MARGIN_SAFETY,
  ZOOM_RATIO_MAX,
  ZOOM_RATIO_MIN,
  evaluateCacheCoverage,
  isZoomRatioWithinCacheRange,
  type AcceptedCacheCoverage,
} from "./cacheCoverage";

const outputBackingSize = { width: 720, height: 432 };

function accepted(
  anchorViewport = createViewport({ x: 0, y: 0 }, 1, { width: 1000, height: 600 }),
  marginCssPx = 240,
): AcceptedCacheCoverage {
  return {
    anchorViewport,
    marginCssPx,
    viewportCssSize: anchorViewport.screen,
    outputBackingSize,
  };
}

describe("accepted cache coverage", () => {
  it("uses the exact normative thresholds with inclusive zoom boundaries", () => {
    expect({ ZOOM_RATIO_MIN, ZOOM_RATIO_MAX, CACHE_MARGIN_SAFETY }).toEqual({
      ZOOM_RATIO_MIN: 0.68,
      ZOOM_RATIO_MAX: 1.47,
      CACHE_MARGIN_SAFETY: 0.3,
    });
    expect(isZoomRatioWithinCacheRange(0.68)).toBe(true);
    expect(isZoomRatioWithinCacheRange(1.47)).toBe(true);
    expect(isZoomRatioWithinCacheRange(0.68 - Number.EPSILON)).toBe(false);
    expect(isZoomRatioWithinCacheRange(1.47 + Number.EPSILON)).toBe(false);
  });

  it("classifies exact and just-outside zoom ratios independently of coverage geometry", () => {
    const anchor = createViewport({ x: 0, y: 0 }, 1, { width: 1000, height: 600 });
    const cache = accepted(anchor, 1000);

    for (const ratio of [ZOOM_RATIO_MIN, ZOOM_RATIO_MAX]) {
      const evaluation = evaluateCacheCoverage(cache, {
        viewport: { ...anchor, zoom: anchor.zoom * ratio },
        outputBackingSize,
      });
      expect(evaluation.reasons).not.toContain("zoom-ratio-outside");
    }
    for (const ratio of [ZOOM_RATIO_MIN - 0.0001, ZOOM_RATIO_MAX + 0.0001]) {
      const evaluation = evaluateCacheCoverage(cache, {
        viewport: { ...anchor, zoom: anchor.zoom * ratio },
        outputBackingSize,
      });
      expect(evaluation.reasons).toContain("zoom-ratio-outside");
    }
  });

  it("keeps ordinary pan and zoom safely inside accepted coverage", () => {
    const cache = accepted();
    const evaluation = evaluateCacheCoverage(cache, {
      viewport: createViewport({ x: 80, y: -60 }, 1.1, cache.viewportCssSize),
      outputBackingSize,
    });
    expect(evaluation).toMatchObject({ requiresRebuild: false, reasons: [] });
  });

  it("keeps 120 bounded camera samples inside accepted coverage", () => {
    const cache = accepted(undefined, 600);
    const evaluations = Array.from({ length: 120 }, (_, sample) => {
      const phase = (sample / 119) * Math.PI * 2;
      return evaluateCacheCoverage(cache, {
        viewport: {
          pan: { x: Math.sin(phase) * 50, y: Math.cos(phase) * 40 },
          zoom: 1 + Math.sin(phase) * 0.1,
          screen: cache.viewportCssSize,
        },
        outputBackingSize,
      });
    });
    expect(evaluations.every(({ requiresRebuild }) => !requiresRebuild)).toBe(true);
  });

  it.each([
    ["left", { x: 168, y: 0 }, "cache-left-safety"],
    ["right", { x: -168, y: 0 }, "cache-right-safety"],
    ["top", { x: 0, y: 168 }, "cache-top-safety"],
    ["bottom", { x: 0, y: -168 }, "cache-bottom-safety"],
  ] as const)("requires rebuild when the viewport reaches the %s safety edge", (_, pan, reason) => {
    const cache = accepted();
    const evaluation = evaluateCacheCoverage(cache, {
      viewport: createViewport(pan, 1, cache.viewportCssSize),
      outputBackingSize,
    });
    expect(evaluation.reasons).toContain(reason);
  });

  it("does not rebuild immediately before each margin-safety edge", () => {
    for (const pan of [
      { x: 167.999, y: 0 },
      { x: -167.999, y: 0 },
      { x: 0, y: 167.999 },
      { x: 0, y: -167.999 },
    ]) {
      expect(
        evaluateCacheCoverage(accepted(), {
          viewport: createViewport(pan, 1, { width: 1000, height: 600 }),
          outputBackingSize,
        }).requiresRebuild,
      ).toBe(false);
    }
  });

  it("uses canonical transforms for a non-1 zoom and translated anchor", () => {
    const anchor = createViewport({ x: 120, y: -80 }, 2, { width: 800, height: 600 });
    const evaluation = evaluateCacheCoverage(accepted(anchor), {
      viewport: createViewport({ x: 220, y: -30 }, 2, anchor.screen),
      outputBackingSize,
    });
    expect(evaluation.requiresRebuild).toBe(false);
    expect(evaluation.transformedViewportInAnchorCss).toEqual({
      x: -100,
      y: -50,
      width: 800,
      height: 600,
    });
  });

  it("invalidates viewport and output dimension mismatches explicitly", () => {
    const cache = accepted();
    const evaluation = evaluateCacheCoverage(cache, {
      viewport: createViewport({ x: 0, y: 0 }, 1, { width: 1001, height: 600 }),
      outputBackingSize: { width: 721, height: 432 },
    });
    expect(evaluation.reasons).toContain("viewport-size-changed");
    expect(evaluation.reasons).toContain("output-size-changed");
  });

  it.each([
    { width: 1, height: 1 },
    { width: 4000, height: 200 },
    { width: 200, height: 4000 },
    { width: 12_000, height: 8_000 },
  ])("handles tiny, large, and unusual $width x $height viewports", (screen) => {
    const anchor = createViewport({ x: 17, y: -31 }, 1.25, screen);
    expect(
      evaluateCacheCoverage(accepted(anchor, 900), { viewport: anchor, outputBackingSize })
        .requiresRebuild,
    ).toBe(false);
  });

  it("represents a coverage-required rebuild while a long gesture is still active", () => {
    const cache = accepted();
    const samples = Array.from({ length: 120 }, (_, index) =>
      createViewport({ x: index * 2, y: 0 }, 1, cache.viewportCssSize),
    );
    const evaluations = samples.map((viewport) =>
      evaluateCacheCoverage(cache, { viewport, outputBackingSize }),
    );
    expect(evaluations[80].requiresRebuild).toBe(false);
    expect(evaluations[84].reasons).toContain("cache-left-safety");
    expect(evaluations[evaluations.length - 1].requiresRebuild).toBe(true);
  });

  it("fails closed for invalid coverage assumptions", () => {
    const invalidAnchor = {
      pan: { x: Number.NaN, y: 0 },
      zoom: 0,
      screen: { width: 0, height: 600 },
    };
    const evaluation = evaluateCacheCoverage(
      {
        anchorViewport: invalidAnchor,
        marginCssPx: Number.NaN,
        viewportCssSize: invalidAnchor.screen,
        outputBackingSize,
      },
      {
        viewport: invalidAnchor,
        outputBackingSize: { width: 0, height: 432 },
      },
    );
    expect(evaluation).toEqual({
      requiresRebuild: true,
      reasons: ["invalid-input"],
      zoomRatio: null,
      transformedViewportInAnchorCss: null,
    });
  });
});
