import type {
  CssMaterialDefinition,
  MaterialDefinition,
  MaterialHighlightStops,
  NativeGlassMaterialDefinition,
  OpaqueMaterialDefinition,
} from "./materialTypes";

const NATIVE_GLASS_RIM = Object.freeze({
  widthPx: 1.5,
  softnessPx: 0.5,
  exposure: 0.9,
  lightDirectionDegrees: -22,
  primaryStrength: 2,
  oppositeStrength: 1.04,
  sharpness: 6,
  specularOpacity: 0.75,
});

export const ACRYLIC_LARGE = Object.freeze({
  id: "acrylic-large",
  strategy: "native-glass",
  role: "large",
  defaultRadiusPx: 23,
  blurPx: 60,
  preblurPx: 6,
  interactionPreblurPx: null,
  saturation: 0.78,
  brightness: 0.82,
  contrast: 1,
  overscanRatio: 3,
  tint: Object.freeze({ rgb: Object.freeze([186, 190, 196] as const), opacity: 0.075 }),
  tone: Object.freeze({ rgb: Object.freeze([14, 15, 17] as const), opacity: 0 }),
  rim: Object.freeze({ ...NATIVE_GLASS_RIM, baseAlpha: 0.205 }),
  shadow: Object.freeze({
    xPx: 0,
    yPx: 3.5,
    blurPx: 16.5,
    spreadPx: 0,
    opacity: 0.5,
  }),
} satisfies NativeGlassMaterialDefinition);

export const ACRYLIC_SMALL = Object.freeze({
  id: "acrylic-small",
  strategy: "native-glass",
  role: "small",
  defaultRadiusPx: 13.5,
  blurPx: 23.5,
  preblurPx: 5,
  interactionPreblurPx: null,
  saturation: 0.78,
  brightness: 0.9,
  contrast: 1,
  overscanRatio: 3,
  tint: Object.freeze({ rgb: Object.freeze([182, 183, 195] as const), opacity: 0 }),
  tone: Object.freeze({ rgb: Object.freeze([148, 148, 148] as const), opacity: 0 }),
  rim: Object.freeze({ ...NATIVE_GLASS_RIM, baseAlpha: 0.135 }),
  shadow: Object.freeze({
    xPx: 0,
    yPx: 3.5,
    blurPx: 11.5,
    spreadPx: 0.5,
    opacity: 0.48,
  }),
} satisfies NativeGlassMaterialDefinition);

export const OPAQUE_HIGHLIGHT_STOPS = Object.freeze([
  Object.freeze({ offset: 0, opacityMultiplier: 1 }),
  Object.freeze({ offset: 0.38, opacityMultiplier: 0.4 }),
  Object.freeze({ offset: 0.72, opacityMultiplier: 0 }),
] satisfies MaterialHighlightStops);

export const OPAQUE = Object.freeze({
  id: "opaque",
  strategy: "opaque",
  defaultRadiusPx: 12,
  tint: Object.freeze({ rgb: Object.freeze([24, 25, 27] as const), opacity: 1 as const }),
  highlight: Object.freeze({
    opacity: 0.026,
    radiusMultiplier: 2,
    stops: OPAQUE_HIGHLIGHT_STOPS,
  }),
  border: Object.freeze({
    widthPx: 1,
    topWhiteAlpha: 30 / 255,
    bottomWhiteAlpha: 16 / 255,
  }),
  shadow: Object.freeze({ xPx: 0, yPx: 5, blurPx: 12, opacity: 0.44 }),
} satisfies OpaqueMaterialDefinition);

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
  OPAQUE,
  CUTOUT,
] satisfies readonly MaterialDefinition[]);
