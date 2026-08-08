import type {
  CachedAcrylicMaterialDefinition,
  CssMaterialDefinition,
  MaterialDefinition,
  MaterialHighlightStops,
} from "./materialTypes";

export const SHARED_ACRYLIC_CACHE_PROFILE = Object.freeze({
  id: "shared-acrylic" as const,
  blurRadiusPx: 45,
  saturation: 1,
  brightness: 1,
});

export const ACRYLIC_HIGHLIGHT_STOPS = Object.freeze([
  Object.freeze({ offset: 0, opacityMultiplier: 1 }),
  Object.freeze({ offset: 0.38, opacityMultiplier: 0.4 }),
  Object.freeze({ offset: 0.72, opacityMultiplier: 0 }),
] satisfies MaterialHighlightStops);

export const ACRYLIC_LARGE = Object.freeze({
  id: "acrylic-large",
  strategy: "cached-acrylic",
  cacheProfileId: SHARED_ACRYLIC_CACHE_PROFILE.id,
  defaultRadiusPx: 12,
  tint: Object.freeze({ rgb: Object.freeze([27, 27, 27] as const), opacity: 0.4 }),
  highlight: Object.freeze({
    opacity: 0.04,
    radiusMultiplier: 1,
    stops: ACRYLIC_HIGHLIGHT_STOPS,
  }),
  border: Object.freeze({
    widthPx: 1,
    topWhiteAlpha: 32 / 255,
    bottomWhiteAlpha: 18 / 255,
  }),
  shadow: Object.freeze({ xPx: 0, yPx: 7, blurPx: 20, opacity: 0.55 }),
} satisfies CachedAcrylicMaterialDefinition);

export const ACRYLIC_SMALL = Object.freeze({
  id: "acrylic-small",
  strategy: "cached-acrylic",
  cacheProfileId: SHARED_ACRYLIC_CACHE_PROFILE.id,
  defaultRadiusPx: 12,
  tint: Object.freeze({ rgb: Object.freeze([19, 20, 22] as const), opacity: 0.4 }),
  highlight: Object.freeze({
    opacity: 0.038,
    radiusMultiplier: 2,
    stops: ACRYLIC_HIGHLIGHT_STOPS,
  }),
  border: Object.freeze({
    widthPx: 1,
    topWhiteAlpha: 30 / 255,
    bottomWhiteAlpha: 16 / 255,
  }),
  shadow: Object.freeze({ xPx: 0, yPx: 5, blurPx: 12, opacity: 0.44 }),
} satisfies CachedAcrylicMaterialDefinition);

export const CUTOUT = Object.freeze({
  id: "cutout",
  strategy: "css",
  defaultRadiusPx: null,
  fillRgb: Object.freeze([14, 15, 17] as const),
  border: Object.freeze({
    widthPx: 1.5,
    rgb: Object.freeze([255, 255, 255] as const),
    alpha: 17 / 255,
  }),
  insetShadow: Object.freeze({ xPx: 0, yPx: 8, blurPx: 30, opacity: 0.1 }),
} satisfies CssMaterialDefinition);

export const MATERIAL_DEFINITIONS = Object.freeze([
  ACRYLIC_LARGE,
  ACRYLIC_SMALL,
  CUTOUT,
] satisfies readonly MaterialDefinition[]);
