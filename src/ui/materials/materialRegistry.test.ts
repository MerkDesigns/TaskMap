import { describe, expect, it } from "vitest";
import {
  ACRYLIC_LARGE,
  ACRYLIC_SMALL,
  CUTOUT,
  MATERIAL_DEFINITIONS,
  OPAQUE,
  OPAQUE_HIGHLIGHT_STOPS,
} from "./materialDefinitions";
import {
  LEGACY_ACRYLIC_LARGE,
  LEGACY_ACRYLIC_SMALL,
  LEGACY_SHARED_ACRYLIC_CACHE_PROFILE,
} from "./legacyCachedAcrylicDefinitions";
import { createMaterialRegistry, materialRegistry } from "./materialRegistry";

describe("material definitions", () => {
  it("registers only the production material IDs", () => {
    expect(materialRegistry.ids).toEqual(["acrylic-large", "acrylic-small", "opaque", "cutout"]);
    expect(MATERIAL_DEFINITIONS).toEqual([ACRYLIC_LARGE, ACRYLIC_SMALL, OPAQUE, CUTOUT]);
  });

  it("locks the accepted permanent two-pass native Large material", () => {
    expect(ACRYLIC_LARGE).toEqual({
      id: "acrylic-large",
      strategy: "native-glass",
      role: "large",
      defaultRadiusPx: 23,
      blurPx: 38,
      preblurPx: 6,
      interactionPreblurPx: null,
      saturation: 0.78,
      brightness: 0.82,
      contrast: 1,
      overscanRatio: 1.15,
      tint: { rgb: [39, 40, 42], opacity: 0.45 },
      tone: { rgb: [14, 15, 17], opacity: 0 },
      rim: {
        widthPx: 1.5,
        softnessPx: 0.5,
        exposure: 0.9,
        lightDirectionDegrees: -22,
        primaryStrength: 2,
        oppositeStrength: 1.04,
        sharpness: 6,
        specularOpacity: 0.75,
        baseAlpha: 0.205,
      },
      shadow: { xPx: 0, yPx: 3.5, blurPx: 16.5, spreadPx: 0, opacity: 0.5 },
    });
  });

  it("locks the accepted settled and moving native Small material", () => {
    expect(ACRYLIC_SMALL).toEqual({
      id: "acrylic-small",
      strategy: "native-glass",
      role: "small",
      defaultRadiusPx: 13.5,
      blurPx: 20,
      preblurPx: null,
      interactionPreblurPx: 5,
      saturation: 0.78,
      brightness: 0.9,
      contrast: 1,
      overscanRatio: 1.15,
      tint: { rgb: [133, 133, 133], opacity: 0.025 },
      tone: { rgb: [148, 148, 148], opacity: 0 },
      rim: {
        widthPx: 1.5,
        softnessPx: 0.5,
        exposure: 0.9,
        lightDirectionDegrees: -22,
        primaryStrength: 2,
        oppositeStrength: 1.04,
        sharpness: 6,
        specularOpacity: 0.75,
        baseAlpha: 0.135,
      },
      shadow: { xPx: 0, yPx: 3.5, blurPx: 11.5, spreadPx: 0.5, opacity: 0.48 },
    });
  });

  it("keeps the previous cached candidate available only as legacy rollback data", () => {
    expect(LEGACY_SHARED_ACRYLIC_CACHE_PROFILE).toEqual({
      id: "shared-acrylic",
      blurRadiusPx: 45,
      saturation: 1,
      brightness: 1,
    });
    expect(LEGACY_ACRYLIC_LARGE.strategy).toBe("cached-acrylic");
    expect(LEGACY_ACRYLIC_SMALL.strategy).toBe("cached-acrylic");
    expect(MATERIAL_DEFINITIONS).not.toContain(LEGACY_ACRYLIC_LARGE);
    expect(MATERIAL_DEFINITIONS).not.toContain(LEGACY_ACRYLIC_SMALL);
  });

  it("preserves Opaque and Cutout without native backdrop registration", () => {
    expect(OPAQUE).toEqual({
      id: "opaque",
      strategy: "opaque",
      defaultRadiusPx: 12,
      tint: { rgb: [24, 25, 27], opacity: 1 },
      highlight: { opacity: 0.026, radiusMultiplier: 2, stops: OPAQUE_HIGHLIGHT_STOPS },
      border: { widthPx: 1, topWhiteAlpha: 30 / 255, bottomWhiteAlpha: 16 / 255 },
      shadow: { xPx: 0, yPx: 5, blurPx: 12, opacity: 0.44 },
    });
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
