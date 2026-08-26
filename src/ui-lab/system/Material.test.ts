import { describe, expect, it } from "vitest";
import { SURFACE_MATERIAL_ALIASES, resolveSurfaceMaterial } from "./Material";

describe("UI Lab target materials", () => {
  it("maps every target name to the current production material identifier", () => {
    expect(SURFACE_MATERIAL_ALIASES).toEqual({
      "major-glass": "acrylic-large",
      "minor-glass": "acrylic-small",
      opaque: "opaque",
      cutout: "cutout",
    });

    for (const [target, current] of Object.entries(SURFACE_MATERIAL_ALIASES)) {
      expect(resolveSurfaceMaterial(target as keyof typeof SURFACE_MATERIAL_ALIASES)).toBe(current);
    }
  });
});
