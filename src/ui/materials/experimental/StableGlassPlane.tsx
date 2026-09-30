import { NativeGlassPlane, type NativeGlassShape } from "../NativeGlassPlane";
import { useId, useLayoutEffect, useRef, type ReactNode } from "react";
import { ACRYLIC_LARGE, ACRYLIC_SMALL } from "../materialDefinitions";
import { createMaterialSurfaceStyle } from "../materialSurfaceStyle";
import { drawNativeGlassRim } from "../nativeGlassRim";
import "../MaterialSurface.css";
import "../nativeGlassRecipe.css";
import "./stableGlassPlane.css";

/** Experimental backend, imported only by the development rendering proof. */
export type StableGlassDepth = "major-base" | "minor-settled" | "minor-promoted" | "major-overlay";
export type StableGlassShape = NativeGlassShape;
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
  occluders = [],
}: {
  readonly depth: StableGlassDepth;
  readonly width: number;
  readonly height: number;
  readonly shapes: readonly StableGlassShape[];
  readonly occluders?: readonly StableGlassShape[];
}) {
  return (
    <NativeGlassPlane
      definition={recipe(depth)}
      width={width}
      height={height}
      shapes={shapes}
      occluders={occluders}
      zIndex={depths[depth]}
      data-stable-glass-depth={depth}
    />
  );
}
/** Ordinary foreground shell: no filter nodes, ancestor masks or geometry measurement. */
export function StableGlassSurface({
  depth,
  shape,
  name,
  children,
  occlusion,
}: {
  readonly depth: StableGlassDepth;
  readonly shape: StableGlassShape;
  readonly name: string;
  readonly children: ReactNode;
  /** Intersect inverse sibling silhouettes on this filter-free shell and its hit area. */
  readonly occlusion?: {
    readonly width: number;
    readonly height: number;
    readonly shapes: readonly StableGlassShape[];
  };
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const clipId = `stable-occlusion-${useId().replace(/:/g, "")}`;
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
        ...(occlusion?.shapes.length && {
          clipPath: `url(#${clipId}-${occlusion.shapes.length - 1})`,
        }),
      })}
    >
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <defs>
          {occlusion?.shapes.map((upper, index) => (
            <clipPath key={index} id={`${clipId}-${index}`} clipPathUnits="userSpaceOnUse">
              <path
                d={shellOcclusionPath(shape, { ...occlusion, shape: upper })}
                clipRule="evenodd"
                clipPath={index ? `url(#${clipId}-${index - 1})` : undefined}
              />
            </clipPath>
          ))}
        </defs>
      </svg>
      <span className="taskmap-material-native-glass__highlight" aria-hidden="true" />
      <span className="taskmap-material-native-glass__rim" aria-hidden="true">
        <canvas ref={canvas} className="taskmap-material-native-glass__rim-canvas" />
      </span>
      {children}
    </div>
  );
}

/** Unlike an alpha mask, clipping also excludes covered foreground from hit testing.
 * The outside contour includes scene-space effects; no backdrop filter is a descendant.
 * Each inverse silhouette is intersected with the previous clip. Unlike multiple
 * even-odd holes in one path, their overlap never re-exposes lower content. */
function shellOcclusionPath(
  origin: StableGlassShape,
  occlusion: { width: number; height: number; shape: StableGlassShape },
): string {
  const { shape } = occlusion;
  const x = shape.x - origin.x;
  const y = shape.y - origin.y;
  const right = x + shape.width;
  const bottom = y + shape.height;
  const r = Math.max(0, Math.min(shape.radius, shape.width / 2, shape.height / 2));
  const outer = `M${-origin.x} ${-origin.y}h${occlusion.width}v${occlusion.height}h${-occlusion.width}Z`;
  const hole = `M${x + r} ${y}H${right - r}A${r} ${r} 0 0 1 ${right} ${y + r}V${bottom - r}A${r} ${r} 0 0 1 ${right - r} ${bottom}H${x + r}A${r} ${r} 0 0 1 ${x} ${bottom - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
  return `${outer} ${hole}`;
}
