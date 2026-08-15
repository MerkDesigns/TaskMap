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
      blur: 100,
      bezelWidth: 0,
      thickness: 0,
      displacementFactor: -3,
      displacementBlur: 0,
      ior: 0.5,
      contentIor: 0.5,
      contentDepth: 0,
      dispersion: 0,
      surfaceProfile: "convex",
      lightDirection: -0.5236,
      specularStrength: 1,
      specularWidth: 1,
      specularFalloff: 2.5,
      oppositeSpecularStrength: 0.69,
      specularSharpness: 3,
      specularOpacity: 0.66,
      reflectionOffset: 18,
      tint: { r: 0.1765, g: 0.1765, b: 0.1843, a: 0.3 },
      shadowColor: { r: 0, g: 0, b: 0, a: 0.3 },
      shadowOffsetX: 0,
      shadowOffsetY: 2,
      shadowBlur: 11,
      shadowSpread: 2,
      debugDisplacement: false,
    });
  });

  it("uses the approved Small Panel optical preset", () => {
    expect(LIQUID_MATERIAL_OPTICS["small-panel"]).toEqual({
      opacity: 1,
      spacing: 0,
      blur: 30,
      bezelWidth: 0,
      thickness: 0,
      displacementFactor: -3,
      displacementBlur: 0,
      ior: 0.5,
      contentIor: 0.5,
      contentDepth: 0,
      dispersion: 0,
      surfaceProfile: "convex",
      lightDirection: -0.5236,
      specularStrength: 1,
      specularWidth: 1,
      specularFalloff: 2.5,
      oppositeSpecularStrength: 0.69,
      specularSharpness: 3,
      specularOpacity: 0.66,
      reflectionOffset: 18,
      tint: { r: 0.1765, g: 0.1765, b: 0.1843, a: 0 },
      shadowColor: { r: 0, g: 0, b: 0, a: 0.3 },
      shadowOffsetX: 0,
      shadowOffsetY: 2,
      shadowBlur: 11,
      shadowSpread: 2,
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
