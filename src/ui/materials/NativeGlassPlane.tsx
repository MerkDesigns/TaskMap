import type { CSSProperties, HTMLAttributes } from "react";
import { createMaterialSurfaceStyle } from "./materialSurfaceStyle";
import type { NativeGlassMaterialDefinition } from "./materialTypes";
import type { MaterialRectangle } from "./materialSamplingBoundary";
import "./MaterialSurface.css";
import "./nativeGlassRecipe.css";
import "./NativeGlassPlane.css";

export interface NativeGlassShape {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly radius: number;
  readonly opacity?: number;
  readonly clip?: MaterialRectangle;
  /** Render `clip` as the visible silhouette with the shape's radius (settled scroll-edge morph). */
  readonly morph?: boolean;
}

/** Stable sampling bounds, with rounded masks only on each filter output. */
export function NativeGlassPlane({
  definition,
  width,
  height,
  shapes,
  occluders = [],
  zIndex = 1,
  ...props
}: {
  readonly definition: NativeGlassMaterialDefinition;
  readonly width: number;
  readonly height: number;
  readonly shapes: readonly NativeGlassShape[];
  readonly occluders?: readonly NativeGlassShape[];
  readonly zIndex?: number;
} & HTMLAttributes<HTMLDivElement>) {
  const style = {
    ...createMaterialSurfaceStyle(definition, "none", 0, undefined),
    width,
    height,
    zIndex,
    "--taskmap-plane-mask": outputMask(width, height, shapes, occluders),
  } as CSSProperties;
  return (
    <div
      {...props}
      className="taskmap-native-glass-plane taskmap-native-glass-recipe"
      data-material-role={definition.role}
      data-plane-shape-count={shapes.length}
      style={style}
      aria-hidden="true"
    >
      <span className="taskmap-native-glass-preblur" data-enabled="true" />
      <span className="taskmap-native-glass-backdrop" />
    </div>
  );
}
export function outputMask(
  width: number,
  height: number,
  shapes: readonly NativeGlassShape[],
  occluders: readonly NativeGlassShape[],
  origin = { x: 0, y: 0 },
): string {
  // WebView2 ignores an SVG mask that paints nothing and shows the whole filter output.
  if (!shapes.length) return "linear-gradient(transparent, transparent)";
  const rectangles = (items: readonly NativeGlassShape[], fill: string) =>
    items
      .map((shape, index) => {
        const { x, y, width: w, height: h, radius, opacity = 1, clip } = morphed(shape);
        const id = `shape-${fill}-${index}`;
        const viewport = clip
          ? `<defs><clipPath id="${id}"><rect x="${clip.left}" y="${clip.top}" width="${clip.width}" height="${clip.height}"/></clipPath></defs>`
          : "";
        return `${viewport}<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.max(0, Math.min(radius, w / 2, h / 2))}" fill="${fill}" opacity="${Math.max(0, Math.min(1, opacity))}"${clip ? ` clip-path="url(#${id})"` : ""}/>`;
      })
      .join("");
  const mask = occluders.length
    ? `<defs><mask id="visible" maskUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="white"/>${rectangles(occluders, "black")}</mask></defs>`
    : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${origin.x} ${origin.y} ${width} ${height}">${mask}<g${occluders.length ? ' mask="url(#visible)"' : ""}>${rectangles(shapes, "white")}</g></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** A morphing shape's visible slice becomes the whole rounded silhouette. */
export function morphed(shape: NativeGlassShape): NativeGlassShape {
  if (!shape.morph || !shape.clip) return shape;
  const { clip } = shape;
  return {
    ...shape,
    x: clip.left,
    y: clip.top,
    width: clip.width,
    height: clip.height,
    clip: undefined,
    morph: undefined,
  };
}
