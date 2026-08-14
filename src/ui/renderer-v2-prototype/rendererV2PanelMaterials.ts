import type { LiquidMaterialOptics } from "../materials/liquid-dom/materialRoles";
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
    ...RENDERER_V2_PANEL_OPTICS[role],
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

// Backup of the two prototype panel materials used before the unified material.
export const RENDERER_V2_PANEL_OPTICS_BACKUP = Object.freeze({
  "large-panel": Object.freeze({
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
    tint: Object.freeze({ r: 0.1373, g: 0.1412, b: 0.1412, a: 0.49 }),
    shadowColor: Object.freeze({ r: 0, g: 0, b: 0, a: 0.1 }),
    shadowOffsetX: 0,
    shadowOffsetY: 14,
    shadowBlur: 30,
    shadowSpread: 0,
    debugDisplacement: false,
  }),
  "small-panel": Object.freeze({
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
    tint: Object.freeze({ r: 0.1765, g: 0.1804, b: 0.1843, a: 0 }),
    shadowColor: Object.freeze({ r: 0, g: 0, b: 0, a: 0.42 }),
    shadowOffsetX: 0,
    shadowOffsetY: 5,
    shadowBlur: 11,
    shadowSpread: -2,
    debugDisplacement: false,
  }),
} satisfies Readonly<Record<RendererV2PanelRole, LiquidMaterialOptics>>);

// Current Renderer V2 panel optics. Geometry, dimensions, spacing, and content are owned elsewhere.
export const RENDERER_V2_PANEL_OPTICS = Object.freeze({
  "large-panel": Object.freeze({
    opacity: 1,
    spacing: 12,
    blur: 60,
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
    tint: Object.freeze({ r: 0.1765, g: 0.1765, b: 0.1843, a: 0 }),
    shadowColor: Object.freeze({ r: 0, g: 0, b: 0, a: 0.3 }),
    shadowOffsetX: 0,
    shadowOffsetY: 2,
    shadowBlur: 11,
    shadowSpread: 2,
    debugDisplacement: false,
  }),
  "small-panel": Object.freeze({
    opacity: 1,
    spacing: 12,
    blur: 60,
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
    tint: Object.freeze({ r: 0.1765, g: 0.1765, b: 0.1843, a: 0 }),
    shadowColor: Object.freeze({ r: 0, g: 0, b: 0, a: 0.3 }),
    shadowOffsetX: 0,
    shadowOffsetY: 2,
    shadowBlur: 11,
    shadowSpread: 2,
    debugDisplacement: false,
  }),
} satisfies Readonly<Record<RendererV2PanelRole, LiquidMaterialOptics>>);
