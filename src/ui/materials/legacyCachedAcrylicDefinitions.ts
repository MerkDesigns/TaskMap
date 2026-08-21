import type {
  MaterialBorderDefinition,
  MaterialHighlightDefinition,
  MaterialHighlightStops,
  MaterialId,
  MaterialRgb,
  MaterialShadowDefinition,
} from "./materialTypes";

export interface LegacyCachedAcrylicMaterialDefinition {
  readonly id: Extract<MaterialId, "acrylic-large" | "acrylic-small">;
  readonly strategy: "cached-acrylic";
  readonly cacheProfileId: "shared-acrylic";
  readonly defaultRadiusPx: number;
  readonly tint: { readonly rgb: MaterialRgb; readonly opacity: number };
  readonly highlight: MaterialHighlightDefinition;
  readonly border: MaterialBorderDefinition;
  readonly shadow: MaterialShadowDefinition;
}

export const LEGACY_SHARED_ACRYLIC_CACHE_PROFILE = Object.freeze({
  id: "shared-acrylic" as const,
  blurRadiusPx: 45,
  saturation: 1,
  brightness: 1,
});

export const LEGACY_ACRYLIC_HIGHLIGHT_STOPS = Object.freeze([
  Object.freeze({ offset: 0, opacityMultiplier: 1 }),
  Object.freeze({ offset: 0.38, opacityMultiplier: 0.4 }),
  Object.freeze({ offset: 0.72, opacityMultiplier: 0 }),
] satisfies MaterialHighlightStops);

export const LEGACY_ACRYLIC_LARGE = Object.freeze({
  id: "acrylic-large",
  strategy: "cached-acrylic",
  cacheProfileId: LEGACY_SHARED_ACRYLIC_CACHE_PROFILE.id,
  defaultRadiusPx: 12,
  tint: Object.freeze({ rgb: Object.freeze([27, 27, 27] as const), opacity: 0.4 }),
  highlight: Object.freeze({
    opacity: 0.028,
    radiusMultiplier: 1,
    stops: LEGACY_ACRYLIC_HIGHLIGHT_STOPS,
  }),
  border: Object.freeze({
    widthPx: 1,
    topWhiteAlpha: 32 / 255,
    bottomWhiteAlpha: 18 / 255,
  }),
  shadow: Object.freeze({ xPx: 0, yPx: 7, blurPx: 20, opacity: 0.55 }),
} satisfies LegacyCachedAcrylicMaterialDefinition);

export const LEGACY_ACRYLIC_SMALL = Object.freeze({
  id: "acrylic-small",
  strategy: "cached-acrylic",
  cacheProfileId: LEGACY_SHARED_ACRYLIC_CACHE_PROFILE.id,
  defaultRadiusPx: 12,
  tint: Object.freeze({ rgb: Object.freeze([19, 20, 22] as const), opacity: 0.4 }),
  highlight: Object.freeze({
    opacity: 0.026,
    radiusMultiplier: 2,
    stops: LEGACY_ACRYLIC_HIGHLIGHT_STOPS,
  }),
  border: Object.freeze({
    widthPx: 1,
    topWhiteAlpha: 30 / 255,
    bottomWhiteAlpha: 16 / 255,
  }),
  shadow: Object.freeze({ xPx: 0, yPx: 5, blurPx: 12, opacity: 0.44 }),
} satisfies LegacyCachedAcrylicMaterialDefinition);
