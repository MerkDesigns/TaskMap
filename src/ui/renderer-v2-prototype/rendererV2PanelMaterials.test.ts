import { describe, expect, it } from "vitest";
import {
  LIQUID_MATERIAL_OPTICS,
  type LiquidMaterialRole,
} from "../materials/liquid-dom/materialRoles";
import {
  DEFAULT_RENDERER_V2_MATERIAL_CONTROLS,
  rendererV2OpticsWithControls,
} from "./rendererV2PanelMaterials";

describe("Renderer V2 panel material controls", () => {
  it.each(["large-panel", "small-panel"] satisfies LiquidMaterialRole[])(
    "starts %s tuning from the canonical approved optics",
    (role) => {
      expect(
        rendererV2OpticsWithControls(role, DEFAULT_RENDERER_V2_MATERIAL_CONTROLS[role]),
      ).toEqual(LIQUID_MATERIAL_OPTICS[role]);
    },
  );
});
