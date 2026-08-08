import { describe, expect, it } from "vitest";
import {
  ACRYLIC_HIGHLIGHT_STOPS,
  ACRYLIC_LARGE,
  ACRYLIC_SMALL,
  CUTOUT,
  MATERIAL_DEFINITIONS,
  SHARED_ACRYLIC_CACHE_PROFILE,
} from "./materialDefinitions";
import { createMaterialRegistry, materialRegistry } from "./materialRegistry";

describe("material definitions", () => {
  it("registers only the Phase 4.5 material IDs", () => {
    expect(materialRegistry.ids).toEqual(["acrylic-large", "acrylic-small", "cutout"]);
    expect(MATERIAL_DEFINITIONS).toEqual([ACRYLIC_LARGE, ACRYLIC_SMALL, CUTOUT]);
  });

  it("preserves the exact shared expensive acrylic profile", () => {
    expect(SHARED_ACRYLIC_CACHE_PROFILE).toEqual({
      id: "shared-acrylic",
      blurRadiusPx: 45,
      saturation: 1,
      brightness: 1,
    });
    expect(ACRYLIC_LARGE.cacheProfileId).toBe(SHARED_ACRYLIC_CACHE_PROFILE.id);
    expect(ACRYLIC_SMALL.cacheProfileId).toBe(SHARED_ACRYLIC_CACHE_PROFILE.id);
  });

  it("preserves the exact Large overlay definition", () => {
    expect(ACRYLIC_LARGE).toEqual({
      id: "acrylic-large",
      strategy: "cached-acrylic",
      cacheProfileId: "shared-acrylic",
      defaultRadiusPx: 12,
      tint: { rgb: [27, 27, 27], opacity: 0.4 },
      highlight: {
        opacity: 0.04,
        radiusMultiplier: 1,
        stops: ACRYLIC_HIGHLIGHT_STOPS,
      },
      border: { widthPx: 1, topWhiteAlpha: 32 / 255, bottomWhiteAlpha: 18 / 255 },
      shadow: { xPx: 0, yPx: 7, blurPx: 20, opacity: 0.55 },
    });
  });

  it("preserves the exact Small overlay while sharing the Large cache", () => {
    expect(ACRYLIC_SMALL).toEqual({
      id: "acrylic-small",
      strategy: "cached-acrylic",
      cacheProfileId: "shared-acrylic",
      defaultRadiusPx: 12,
      tint: { rgb: [19, 20, 22], opacity: 0.4 },
      highlight: {
        opacity: 0.038,
        radiusMultiplier: 2,
        stops: ACRYLIC_HIGHLIGHT_STOPS,
      },
      border: { widthPx: 1, topWhiteAlpha: 30 / 255, bottomWhiteAlpha: 16 / 255 },
      shadow: { xPx: 0, yPx: 5, blurPx: 12, opacity: 0.44 },
    });
  });

  it("preserves the exact Cutout definition without inventing a default radius", () => {
    expect(CUTOUT).toEqual({
      id: "cutout",
      strategy: "css",
      defaultRadiusPx: null,
      fillRgb: [14, 15, 17],
      border: { widthPx: 1.5, rgb: [255, 255, 255], alpha: 17 / 255 },
      insetShadow: { xPx: 0, yPx: 8, blurPx: 30, opacity: 0.1 },
    });
  });
});

describe("material registry", () => {
  it("rejects duplicate IDs", () => {
    expect(() => createMaterialRegistry([ACRYLIC_LARGE, ACRYLIC_LARGE])).toThrow(
      "Duplicate material definition: acrylic-large",
    );
  });

  it("returns undefined or a bounded error for an unknown runtime ID", () => {
    expect(materialRegistry.get("not-registered")).toBeUndefined();
    expect(() => materialRegistry.require("not-registered")).toThrow(
      "Unknown material: not-registered",
    );
  });
});
