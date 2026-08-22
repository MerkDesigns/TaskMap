import { forwardRef, useId, type CSSProperties, type HTMLAttributes } from "react";
import { ACRYLIC_LARGE, ACRYLIC_SMALL } from "./materialDefinitions";
import { createMaterialSurfaceStyle } from "./materialSurfaceStyle";
import type { NativeGlassMaterialDefinition } from "./materialTypes";
import "./NativeGlassBatch.css";

export type NativeGlassBatchMaterial = "acrylic-large" | "acrylic-small";

export interface NativeGlassBatchShape {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly radius: number;
}

export interface NativeGlassBatchProps extends HTMLAttributes<HTMLDivElement> {
  readonly batchId: string;
  readonly depth: 1 | 2;
  readonly kind: "large-left" | "large-right" | "small-canvas" | "small-extension";
  readonly material: NativeGlassBatchMaterial;
}

export const NativeGlassBatch = forwardRef<HTMLDivElement, NativeGlassBatchProps>(
  function NativeGlassBatch({ batchId, className, depth, kind, material, style, ...props }, ref) {
    const definition = requireNativeDefinition(material);
    const clipId = `taskmap-native-glass-batch-${useId().replace(/:/g, "")}`;
    const materialStyle = {
      ...createMaterialSurfaceStyle(definition, "none", definition.defaultRadiusPx ?? 0, style),
      "--taskmap-native-glass-batch-overscan": `${
        (definition.blurPx + (definition.preblurPx ?? 0)) * definition.overscanRatio
      }px`,
      clipPath: `url(#${clipId})`,
      WebkitClipPath: `url(#${clipId})`,
    } as CSSProperties;

    return (
      <div
        {...props}
        ref={ref}
        className={["taskmap-native-glass-batch", className].filter(Boolean).join(" ")}
        data-glass-batch-id={batchId}
        data-glass-batch-kind={kind}
        data-glass-batch-material={material}
        data-glass-batch-state="inactive"
        data-glass-depth={depth}
        aria-hidden="true"
        style={materialStyle}
      >
        <svg className="taskmap-native-glass-batch__definitions">
          <defs>
            <clipPath id={clipId} clipPathUnits="userSpaceOnUse" data-native-glass-batch-clip />
          </defs>
        </svg>
        {definition.preblurPx === null ? null : (
          <span className="taskmap-native-glass-batch__preblur" data-native-filter-layer />
        )}
        <span className="taskmap-native-glass-batch__backdrop" data-native-filter-layer />
      </div>
    );
  },
);

export function writeNativeGlassBatchShapes(
  batch: HTMLElement,
  shapes: readonly NativeGlassBatchShape[],
): void {
  const clip = batch.querySelector<SVGClipPathElement>("[data-native-glass-batch-clip]");
  if (!clip) return;
  const rectangles = [...clip.querySelectorAll<SVGRectElement>("rect")];

  shapes.forEach((shape, index) => {
    const rectangle =
      rectangles[index] ?? document.createElementNS("http://www.w3.org/2000/svg", "rect");
    if (!rectangles[index]) clip.append(rectangle);
    const radius = Math.max(0, Math.min(shape.radius, shape.width / 2, shape.height / 2));
    rectangle.setAttribute("x", `${shape.x}`);
    rectangle.setAttribute("y", `${shape.y}`);
    rectangle.setAttribute("width", `${shape.width}`);
    rectangle.setAttribute("height", `${shape.height}`);
    rectangle.setAttribute("rx", `${radius}`);
    rectangle.setAttribute("ry", `${radius}`);
  });
  rectangles.slice(shapes.length).forEach((rectangle) => rectangle.remove());
  batch.dataset.glassBatchState = shapes.length > 0 ? "active" : "inactive";
}

function requireNativeDefinition(
  material: NativeGlassBatchMaterial,
): NativeGlassMaterialDefinition {
  return material === "acrylic-large" ? ACRYLIC_LARGE : ACRYLIC_SMALL;
}
