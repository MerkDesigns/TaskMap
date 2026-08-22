import { forwardRef, useId, type CSSProperties, type HTMLAttributes } from "react";
import { ACRYLIC_SMALL } from "./materialDefinitions";
import { createMaterialSurfaceStyle } from "./materialSurfaceStyle";
import "./SharedSmallGlassPlane.css";

export interface SharedSmallGlassShape {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly radius: number;
}

export interface NativeGlassDiagnostics {
  readonly nativeBackdropSurfaceCount: number;
  readonly nativeBackdropFilterLayerCount: number;
  readonly sharedSmallPlaneActive: boolean;
}

export const SharedSmallGlassPlane = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function SharedSmallGlassPlane({ className, style, ...props }, ref) {
    const clipId = `taskmap-shared-small-${useId().replace(/:/g, "")}`;
    const materialStyle = {
      ...createMaterialSurfaceStyle(ACRYLIC_SMALL, "none", ACRYLIC_SMALL.defaultRadiusPx, style),
      "--taskmap-shared-small-overscan": `${ACRYLIC_SMALL.blurPx * ACRYLIC_SMALL.overscanRatio}px`,
    } as CSSProperties;

    return (
      <div
        {...props}
        ref={ref}
        className={["taskmap-shared-small-glass-plane", className].filter(Boolean).join(" ")}
        data-shared-small-glass-plane="inactive"
        data-material="acrylic-small"
        data-material-role="small"
        aria-hidden="true"
        style={{
          ...materialStyle,
          clipPath: `url(#${clipId})`,
          WebkitClipPath: `url(#${clipId})`,
        }}
      >
        <svg className="taskmap-shared-small-glass-plane__definitions">
          <defs>
            <clipPath id={clipId} clipPathUnits="userSpaceOnUse" data-shared-small-glass-clip />
          </defs>
        </svg>
        <span className="taskmap-shared-small-glass-plane__backdrop" />
      </div>
    );
  },
);

export function writeSharedSmallGlassShapes(
  plane: HTMLElement,
  shapes: readonly SharedSmallGlassShape[],
): void {
  const clip = plane.querySelector<SVGClipPathElement>("[data-shared-small-glass-clip]");
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
  plane.dataset.sharedSmallGlassPlane = shapes.length > 0 ? "active" : "inactive";
}

export function readNativeGlassDiagnostics(root?: ParentNode): NativeGlassDiagnostics {
  const owner = root ?? (typeof document === "undefined" ? null : document);
  if (!owner) {
    return {
      nativeBackdropSurfaceCount: 0,
      nativeBackdropFilterLayerCount: 0,
      sharedSmallPlaneActive: false,
    };
  }
  const nativeSurfaces = [
    ...owner.querySelectorAll<HTMLElement>('[data-material-strategy="native-glass"]'),
  ];
  const activeIndividualSurfaces = nativeSurfaces.filter(
    (surface) =>
      surface.dataset.materialBackdropSource !== "shared" ||
      surface.dataset.materialMotion === "active",
  );
  const sharedPlaneCount = owner.querySelectorAll(
    '[data-shared-small-glass-plane="active"]',
  ).length;
  return {
    nativeBackdropSurfaceCount: activeIndividualSurfaces.length + sharedPlaneCount,
    nativeBackdropFilterLayerCount:
      activeIndividualSurfaces.reduce(
        (count, surface) =>
          count +
          1 +
          (surface.dataset.materialRole === "large" ||
          (surface.dataset.materialRole === "small" && surface.dataset.materialMotion === "active")
            ? 1
            : 0),
        0,
      ) + sharedPlaneCount,
    sharedSmallPlaneActive: sharedPlaneCount > 0,
  };
}
