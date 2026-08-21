import type { CSSProperties } from "react";

export type MaterialId = "acrylic-large" | "acrylic-small" | "opaque" | "cutout";
export type MaterialStrategy = "native-glass" | "opaque" | "css";
export type MaterialPlane = "base" | "modal";
export type MaterialElevation = "default" | "none";
export type MaterialSurfaceEffect = "bright-selection";
export type MaterialRgb = readonly [red: number, green: number, blue: number];

export interface MaterialHighlightStop {
  readonly offset: number;
  readonly opacityMultiplier: number;
}

export type MaterialHighlightStops = readonly [
  start: MaterialHighlightStop,
  middle: MaterialHighlightStop,
  end: MaterialHighlightStop,
];

export interface MaterialHighlightDefinition {
  readonly opacity: number;
  readonly radiusMultiplier: number;
  readonly stops: MaterialHighlightStops;
}

export interface MaterialBorderDefinition {
  readonly widthPx: number;
  readonly topWhiteAlpha: number;
  readonly bottomWhiteAlpha: number;
}

export interface MaterialShadowDefinition {
  readonly xPx: number;
  readonly yPx: number;
  readonly blurPx: number;
  readonly opacity: number;
}

interface MaterialDefinitionBase {
  readonly id: MaterialId;
  readonly strategy: MaterialStrategy;
  readonly defaultRadiusPx: number | null;
}

export interface NativeGlassRimDefinition {
  readonly baseAlpha: number;
  readonly widthPx: number;
  readonly softnessPx: number;
  readonly exposure: number;
  readonly lightDirectionDegrees: number;
  readonly primaryStrength: number;
  readonly oppositeStrength: number;
  readonly sharpness: number;
  readonly specularOpacity: number;
}

export interface NativeGlassMaterialDefinition extends MaterialDefinitionBase {
  readonly strategy: "native-glass";
  readonly role: "large" | "small";
  readonly blurPx: number;
  readonly preblurPx: number | null;
  readonly interactionPreblurPx: number | null;
  readonly saturation: number;
  readonly brightness: number;
  readonly contrast: number;
  readonly overscanRatio: number;
  readonly tint: {
    readonly rgb: MaterialRgb;
    readonly opacity: number;
  };
  readonly tone: {
    readonly rgb: MaterialRgb;
    readonly opacity: number;
  };
  readonly rim: NativeGlassRimDefinition;
  readonly shadow: MaterialShadowDefinition & { readonly spreadPx: number };
}

export interface CssMaterialDefinition extends MaterialDefinitionBase {
  readonly strategy: "css";
  readonly fillRgb: MaterialRgb;
  readonly border: {
    readonly widthPx: number;
    readonly rgb: MaterialRgb;
    readonly alpha: number;
  };
  readonly insetShadow: MaterialShadowDefinition;
}

export interface OpaqueMaterialDefinition extends MaterialDefinitionBase {
  readonly strategy: "opaque";
  readonly tint: {
    readonly rgb: MaterialRgb;
    readonly opacity: 1;
  };
  readonly highlight: MaterialHighlightDefinition;
  readonly border: MaterialBorderDefinition;
  readonly shadow: MaterialShadowDefinition;
}

export type MaterialDefinition =
  NativeGlassMaterialDefinition | OpaqueMaterialDefinition | CssMaterialDefinition;

export type MaterialSurfaceStyle = CSSProperties & {
  [name: `--taskmap-material-${string}`]: string | number;
};
