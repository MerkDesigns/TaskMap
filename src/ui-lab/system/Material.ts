import type { MaterialId } from "../../ui/materials/materialTypes";

export type SurfaceMaterial = "major-glass" | "minor-glass" | "opaque" | "cutout";

export const SURFACE_MATERIAL_ALIASES = Object.freeze({
  "major-glass": "acrylic-large",
  "minor-glass": "acrylic-small",
  opaque: "opaque",
  cutout: "cutout",
} as const satisfies Readonly<Record<SurfaceMaterial, MaterialId>>);

export function resolveSurfaceMaterial(material: SurfaceMaterial): MaterialId {
  return SURFACE_MATERIAL_ALIASES[material];
}
