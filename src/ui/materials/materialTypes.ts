import type { CSSProperties } from "react";

export type MaterialId = "acrylic-large" | "acrylic-small" | "opaque" | "cutout";
export type MaterialStrategy = "cached-acrylic" | "opaque" | "css";
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

export interface CachedAcrylicMaterialDefinition extends MaterialDefinitionBase {
  readonly strategy: "cached-acrylic";
  readonly cacheProfileId: "shared-acrylic";
  readonly tint: {
    readonly rgb: MaterialRgb;
    readonly opacity: number;
  };
  readonly highlight: MaterialHighlightDefinition;
  readonly border: MaterialBorderDefinition;
  readonly shadow: MaterialShadowDefinition;
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
  CachedAcrylicMaterialDefinition | OpaqueMaterialDefinition | CssMaterialDefinition;

export type MaterialSurfaceStyle = CSSProperties & {
  [name: `--taskmap-material-${string}`]: string | number;
};
