import {
  LIQUID_MATERIAL_OPTICS,
  type LiquidMaterialOptics,
} from "../materials/liquid-dom/materialRoles";
import type { RendererV2PanelRole } from "./rendererV2PanelGeometry";

export interface RendererV2PanelControls {
  readonly tint: string;
  readonly tintOpacity: number;
  readonly blur: number;
  readonly borderOpacity: number;
}

export type RendererV2MaterialControls = Record<RendererV2PanelRole, RendererV2PanelControls>;
export const DEFAULT_RENDERER_V2_ACCENT = "#ff922b";
export const DEFAULT_RENDERER_V2_MATERIAL_CONTROLS: Readonly<RendererV2MaterialControls> =
  Object.freeze({
    "large-panel": Object.freeze({
      tint: "#2d2d2f",
      tintOpacity: 0.3,
      blur: 100,
      borderOpacity: 0.66,
    }),
    "small-panel": Object.freeze({
      tint: "#2d2d2f",
      tintOpacity: 0,
      blur: 30,
      borderOpacity: 0.66,
    }),
  });

export function createRendererV2MaterialControls(): RendererV2MaterialControls {
  return {
    "large-panel": { ...DEFAULT_RENDERER_V2_MATERIAL_CONTROLS["large-panel"] },
    "small-panel": { ...DEFAULT_RENDERER_V2_MATERIAL_CONTROLS["small-panel"] },
  };
}

export function rendererV2OpticsWithControls(
  role: RendererV2PanelRole,
  controls: RendererV2PanelControls,
): LiquidMaterialOptics {
  const tint = hexToNormalizedRgb(controls.tint);
  return {
    ...LIQUID_MATERIAL_OPTICS[role],
    blur: controls.blur,
    specularOpacity: controls.borderOpacity,
    tint: { ...tint, a: controls.tintOpacity },
  };
}

function hexToNormalizedRgb(hex: string) {
  const normalized = hex.replace("#", "");
  const value = /^[\da-f]{6}$/i.test(normalized) ? normalized : "2d2d2f";
  return {
    r: normalizedColorChannel(value.slice(0, 2)),
    g: normalizedColorChannel(value.slice(2, 4)),
    b: normalizedColorChannel(value.slice(4, 6)),
  };
}

function normalizedColorChannel(channel: string) {
  return Math.round((Number.parseInt(channel, 16) / 255) * 10_000) / 10_000;
}
