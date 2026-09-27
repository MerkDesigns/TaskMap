import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { ACRYLIC_LARGE, ACRYLIC_SMALL } from "../materialDefinitions";
import { createMaterialSurfaceStyle } from "../materialSurfaceStyle";
import { drawNativeGlassRim } from "../nativeGlassRim";
import "../MaterialSurface.css";
import "../nativeGlassRecipe.css";
import "./stableGlassPlane.css";

/** Experimental backend, imported only by the development rendering proof. */
export type StableGlassDepth = "major-base" | "minor-settled" | "minor-promoted" | "major-overlay";
export interface StableGlassShape {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly radius: number;
}
const depths: Record<StableGlassDepth, number> = {
  "major-base": 1,
  "minor-settled": 4,
  "minor-promoted": 6,
  "major-overlay": 9,
};
const recipe = (depth: StableGlassDepth) =>
  depth.startsWith("major") ? ACRYLIC_LARGE : ACRYLIC_SMALL;

export function StableGlassPlane({
  depth,
  width,
  height,
  shapes,
}: {
  readonly depth: StableGlassDepth;
  readonly width: number;
  readonly height: number;
  readonly shapes: readonly StableGlassShape[];
}) {
  const definition = recipe(depth);
  // Only the output mask changes with geometry. Filter bounds/identity remain stable.
  const rectangles = shapes
    .map(({ x, y, width: w, height: h, radius }) => {
      const r = Math.max(0, Math.min(radius, w / 2, h / 2));
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="white"/>`;
    })
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${rectangles}</svg>`;
  const style = {
    ...createMaterialSurfaceStyle(definition, "none", 0, undefined),
    width,
    height,
    zIndex: depths[depth],
    "--taskmap-plane-mask": `url("data:image/svg+xml,${encodeURIComponent(svg)}")`,
  } as CSSProperties;
  return (
    <div
      className="taskmap-stable-glass-plane taskmap-native-glass-recipe"
      data-stable-glass-depth={depth}
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

/** Ordinary foreground shell: no filter nodes, ancestor masks or geometry measurement. */
export function StableGlassSurface({
  depth,
  shape,
  name,
  children,
}: {
  readonly depth: StableGlassDepth;
  readonly shape: StableGlassShape;
  readonly name: string;
  readonly children: ReactNode;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const definition = recipe(depth);
  const { x, y, width, height, radius } = shape;
  useLayoutEffect(() => {
    if (canvas.current)
      drawNativeGlassRim(canvas.current, {
        width,
        height,
        radiusPx: radius,
        devicePixelRatio: window.devicePixelRatio,
        rim: definition.rim,
      });
  }, [definition, width, height, radius]);
  return (
    <div
      className="taskmap-material-surface taskmap-stable-glass-surface"
      data-material-strategy="native-glass"
      data-material-role={definition.role}
      data-material={definition.id}
      data-material-backdrop-source="plane"
      data-proof-surface={name}
      style={createMaterialSurfaceStyle(definition, "default", radius, {
        position: "absolute",
        left: x,
        top: y,
        width,
        height,
        padding: definition.role === "small" ? 14 : 16,
        zIndex: depths[depth] + 1,
      })}
    >
      <span className="taskmap-material-native-glass__highlight" aria-hidden="true" />
      <span className="taskmap-material-native-glass__rim" aria-hidden="true">
        <canvas ref={canvas} className="taskmap-material-native-glass__rim-canvas" />
      </span>
      {children}
    </div>
  );
}
