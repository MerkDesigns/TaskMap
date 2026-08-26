import type { CSSProperties } from "react";
import { materialRegistry } from "../../ui/materials/materialRegistry";
import type { MaterialSurfaceStyle } from "../../ui/materials/materialTypes";
import { resolveSurfaceMaterial, type SurfaceMaterial } from "./Material";

export const PRESENCE_MATERIAL_CLASS = "taskmap-ui-lab-presence-material";

type PresenceMaterialStyle = MaterialSurfaceStyle & {
  "--taskmap-ui-lab-shadow-x": string;
  "--taskmap-ui-lab-shadow-y": string;
  "--taskmap-ui-lab-shadow-first-blur": string;
  "--taskmap-ui-lab-shadow-second-blur": string;
  "--taskmap-ui-lab-shadow-first-spread": string;
  "--taskmap-ui-lab-shadow-second-spread": string;
  "--taskmap-ui-lab-shadow-opacity": number;
};

export function createPresenceMaterialStyle(
  material: SurfaceMaterial,
  style?: CSSProperties,
): PresenceMaterialStyle {
  const definition = materialRegistry.require(resolveSurfaceMaterial(material));
  if (definition.strategy !== "native-glass") {
    throw new RangeError("The presence prototype currently supports native glass Materials only");
  }

  return {
    ...style,
    "--taskmap-ui-lab-shadow-x": `${definition.shadow.xPx}px`,
    "--taskmap-ui-lab-shadow-y": `${definition.shadow.yPx}px`,
    "--taskmap-ui-lab-shadow-first-blur": `${Math.max(0, definition.shadow.blurPx - 4)}px`,
    "--taskmap-ui-lab-shadow-second-blur": `${definition.shadow.blurPx}px`,
    "--taskmap-ui-lab-shadow-first-spread": `${definition.shadow.spreadPx}px`,
    "--taskmap-ui-lab-shadow-second-spread": `${Math.max(-4, definition.shadow.spreadPx - 1)}px`,
    "--taskmap-ui-lab-shadow-opacity": definition.shadow.opacity,
  };
}
