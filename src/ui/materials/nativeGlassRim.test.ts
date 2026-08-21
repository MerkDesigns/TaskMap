// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ACRYLIC_LARGE, ACRYLIC_SMALL } from "./materialDefinitions";
import {
  drawNativeGlassRim,
  nativeGlassSpecularAlpha,
  NATIVE_GLASS_SPECULAR_EXPOSURE,
} from "./nativeGlassRim";

describe("DPR-aware native glass rim", () => {
  it("sizes its bitmap from CSS geometry and device pixel ratio without a frame loop", () => {
    const canvas = { width: 0, height: 0 } as HTMLCanvasElement;
    drawNativeGlassRim(canvas, {
      width: 120.25,
      height: 80.5,
      radiusPx: ACRYLIC_SMALL.defaultRadiusPx,
      devicePixelRatio: 2,
      rim: ACRYLIC_SMALL.rim,
    });
    expect(canvas.width).toBe(241);
    expect(canvas.height).toBe(161);
  });

  it("locks the accepted continuous-normal specular exposure", () => {
    expect(NATIVE_GLASS_SPECULAR_EXPOSURE).toBe(0.3);
    const direction = (ACRYLIC_LARGE.rim.lightDirectionDegrees * Math.PI) / 180;
    const facing = nativeGlassSpecularAlpha(
      ACRYLIC_LARGE.rim,
      Math.sin(direction),
      -Math.cos(direction),
    );
    const perpendicular = nativeGlassSpecularAlpha(
      ACRYLIC_LARGE.rim,
      Math.cos(direction),
      Math.sin(direction),
    );
    expect(facing).toBeCloseTo(0.405, 10);
    expect(perpendicular).toBeCloseTo(0, 10);
  });
});
