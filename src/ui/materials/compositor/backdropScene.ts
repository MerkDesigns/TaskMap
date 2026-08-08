import type { CanvasPoint, CanvasRectangle } from "../../../canvas/geometry/canvasGeometry";
import type { BackdropSceneIdentity } from "./compositorTypes";

export const MAX_BACKDROP_PRIMITIVES = 20_000;
/** Maximum dot marks or line coordinates rasterized inside one cache/world intersection. */
export const MAX_BACKDROP_GRID_MARKS = 50_000;
export const MAX_BACKDROP_COORDINATE_ABS = 1_000_000_000;
export const MAX_BACKDROP_DIMENSION = 1_000_000_000;

export interface BackdropStroke {
  readonly color: string;
  readonly widthWorld: number;
}

export interface FilledRectanglePrimitive {
  readonly kind: "filled-rectangle";
  readonly bounds: CanvasRectangle;
  readonly fill: string;
  readonly stroke: BackdropStroke | null;
}

export interface FilledRoundedRectanglePrimitive {
  readonly kind: "filled-rounded-rectangle";
  readonly bounds: CanvasRectangle;
  readonly radiusWorld: number;
  readonly fill: string;
  readonly stroke: BackdropStroke | null;
}

export type BackdropPrimitive = FilledRectanglePrimitive | FilledRoundedRectanglePrimitive;

interface BackdropGridBase {
  readonly spacingWorld: number;
  readonly offsetWorld: CanvasPoint;
}

export interface DotBackdropGrid extends BackdropGridBase {
  readonly kind: "dots";
  readonly color: string;
  readonly radiusWorld: number;
}

export interface LineBackdropGrid extends BackdropGridBase {
  readonly kind: "lines";
  readonly minorColor: string;
  readonly majorColor: string;
  readonly majorEvery: number;
  readonly lineWidthWorld: number;
}

export type BackdropGrid = DotBackdropGrid | LineBackdropGrid;

export interface BackdropBackground {
  /** Opaque fill for cache area outside the bounded world presentation. */
  readonly cacheFill: string;
  readonly worldFill: string;
  readonly worldCornerRadius: number;
}

/**
 * Immutable, presentation-only worker payload. Every primitive has world bounds so the shared
 * rasterizer can cull against the descriptor's cache rectangle without feature knowledge.
 */
export interface BackdropScene {
  readonly identity: BackdropSceneIdentity;
  readonly worldBounds: CanvasRectangle;
  readonly background: BackdropBackground;
  readonly grid: BackdropGrid | null;
  readonly primitives: readonly BackdropPrimitive[];
}
