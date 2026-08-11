import { describe, expect, it } from "vitest";
import { LIQUID_MATERIAL_OPTICS } from "./materialRoles";

const GEOMETRY_PROPERTIES = [
  "width",
  "height",
  "padding",
  "radius",
  "cornerRadius",
  "position",
  "layout",
  "x",
  "y",
] as const;

describe("Liquid DOM material roles", () => {
  it("defines exactly the Large Panel and Small Panel optical roles", () => {
    expect(Object.keys(LIQUID_MATERIAL_OPTICS)).toEqual(["large-panel", "small-panel"]);
  });

  it("uses the approved Large Panel optical preset", () => {
    expect(LIQUID_MATERIAL_OPTICS["large-panel"]).toEqual({
      opacity: 1,
      spacing: 12,
      blur: 55.5,
      bezelWidth: 0,
      thickness: 21,
      displacementFactor: 1,
      displacementBlur: 6,
      ior: 1.5,
      contentIor: 1,
      contentDepth: 0,
      dispersion: 0,
      surfaceProfile: "convex",
      lightDirection: -0.5236,
      specularStrength: 0.81,
      specularWidth: 0.7,
      specularFalloff: 0,
      oppositeSpecularStrength: 0.5,
      specularSharpness: 3,
      specularOpacity: 0.7,
      reflectionOffset: 18,
      tint: { r: 0.1373, g: 0.1412, b: 0.1412, a: 0.49 },
      shadowColor: { r: 0, g: 0, b: 0, a: 0.1 },
      shadowOffsetX: 0,
      shadowOffsetY: 14,
      shadowBlur: 30,
      shadowSpread: 0,
      debugDisplacement: false,
    });
  });

  it("uses the approved Small Panel optical preset", () => {
    expect(LIQUID_MATERIAL_OPTICS["small-panel"]).toEqual({
      opacity: 1,
      spacing: 12,
      blur: 60,
      bezelWidth: 4.5,
      thickness: 14,
      displacementFactor: 1,
      displacementBlur: 6,
      ior: 1.5,
      contentIor: 1,
      contentDepth: 0,
      dispersion: 0,
      surfaceProfile: "convex",
      lightDirection: -0.5236,
      specularStrength: 0.81,
      specularWidth: 0.7,
      specularFalloff: 0,
      oppositeSpecularStrength: 0.5,
      specularSharpness: 3,
      specularOpacity: 0.7,
      reflectionOffset: 18,
      tint: { r: 0.1765, g: 0.1804, b: 0.1843, a: 0 },
      shadowColor: { r: 0, g: 0, b: 0, a: 0.42 },
      shadowOffsetX: 0,
      shadowOffsetY: 5,
      shadowBlur: 11,
      shadowSpread: -2,
      debugDisplacement: false,
    });
  });

  it("does not encode geometry or layout in either role", () => {
    for (const optics of Object.values(LIQUID_MATERIAL_OPTICS)) {
      for (const property of GEOMETRY_PROPERTIES) {
        expect(optics).not.toHaveProperty(property);
      }
    }
  });
});
