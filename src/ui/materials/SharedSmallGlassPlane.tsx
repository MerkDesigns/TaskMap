import {
  forwardRef,
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type ForwardedRef,
  type HTMLAttributes,
} from "react";
import { ACRYLIC_SMALL } from "./materialDefinitions";
import { createMaterialSurfaceStyle } from "./materialSurfaceStyle";
import { subscribeMaterialTuningChanged } from "./materialGeometryInvalidation";
import { readMaterialGeometryRefreshesPerSecond } from "./materialPerformanceDiagnostics";
import "./SharedSmallGlassPlane.css";
import "./nativeGlassRecipe.css";
import type { MaterialRectangle } from "./materialSamplingBoundary";

export interface SharedSmallGlassShape {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly radius: number;
  readonly clip?: MaterialRectangle;
}

export interface NativeGlassDiagnostics {
  readonly activeDepthCount: number;
  readonly activeGlassBatchCount: number;
  readonly localMaterialBackdropFilterCount: number;
  readonly materialGeometryRefreshesPerSecond: number;
  readonly nativeBackdropSurfaceCount: number;
  readonly nativeBackdropFilterLayerCount: number;
  readonly sharedSmallBatchCount: number;
  readonly sharedSmallPlaneActive: boolean;
  readonly temporaryDragBatchActive: boolean;
}

export interface SharedSmallGlassPlaneProps extends HTMLAttributes<HTMLDivElement> {
  readonly batchId?: string;
  readonly blurPx?: number;
  readonly kind?: "small-canvas" | "small-drag" | "small-extension";
}

export const SharedSmallGlassPlane = forwardRef<HTMLDivElement, SharedSmallGlassPlaneProps>(
  function SharedSmallGlassPlane(
    { batchId = "canvas-small", blurPx, className, kind = "small-canvas", style, ...props },
    ref,
  ) {
    const clipId = `taskmap-shared-small-${useId().replace(/:/g, "")}`;
    const planeRef = useRef<HTMLDivElement | null>(null);
    const refreshTuning = useCallback(
      () => refreshSharedSmallGlassTuning(planeRef.current, blurPx),
      [blurPx],
    );
    const composedRef = useCallback(
      (element: HTMLDivElement | null) => {
        planeRef.current = element;
        assignRef(ref, element);
      },
      [ref],
    );
    useLayoutEffect(() => {
      refreshTuning();
      if (!import.meta.env.DEV || blurPx !== undefined) return;
      return subscribeMaterialTuningChanged(refreshTuning);
    }, [blurPx, refreshTuning]);
    const materialStyle = {
      ...createMaterialSurfaceStyle(ACRYLIC_SMALL, "none", ACRYLIC_SMALL.defaultRadiusPx, style),
      ...(blurPx === undefined
        ? {}
        : { "--taskmap-material-small-blur-override": `${Math.max(0, blurPx)}px` }),
      clipPath: `url(#${clipId})`,
      WebkitClipPath: `url(#${clipId})`,
    } as CSSProperties;

    return (
      <div
        {...props}
        ref={composedRef}
        className={["taskmap-shared-small-glass-plane", "taskmap-native-glass-recipe", className]
          .filter(Boolean)
          .join(" ")}
        data-glass-batch-id={batchId}
        data-glass-batch-kind={kind}
        data-glass-batch-material="acrylic-small"
        data-glass-batch-state="inactive"
        data-glass-depth="2"
        data-shared-small-glass-plane="inactive"
        data-material="acrylic-small"
        data-material-role="small"
        aria-hidden="true"
        style={materialStyle}
      >
        <svg className="taskmap-shared-small-glass-plane__definitions">
          <defs>
            <clipPath id={clipId} clipPathUnits="userSpaceOnUse" data-shared-small-glass-clip />
          </defs>
        </svg>
        <span
          className="taskmap-shared-small-glass-plane__preblur taskmap-native-glass-preblur"
          data-enabled="true"
          data-native-filter-layer
        />
        <span
          className="taskmap-shared-small-glass-plane__backdrop taskmap-native-glass-backdrop"
          data-native-filter-layer
        />
      </div>
    );
  },
);

export function refreshSharedSmallGlassTuning(
  plane: HTMLElement | null,
  blurOverride?: number,
): void {
  if (!plane) return;
  const style = getComputedStyle(plane);
  const tunedBlur = Number.parseFloat(
    style.getPropertyValue("--taskmap-material-small-blur-override"),
  );
  const blur =
    typeof blurOverride === "number" && Number.isFinite(blurOverride)
      ? Math.max(0, blurOverride)
      : Number.isFinite(tunedBlur)
        ? Math.max(0, tunedBlur)
        : ACRYLIC_SMALL.blurPx;
  plane.style.setProperty(
    "--taskmap-shared-small-overscan",
    `${(blur + (ACRYLIC_SMALL.preblurPx ?? 0)) * ACRYLIC_SMALL.overscanRatio}px`,
  );
}

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
    const clipId = `${clip.id}-viewport-${index}`;
    let viewportClip = plane.querySelector<SVGClipPathElement>(
      `[data-glass-viewport-clip="${index}"]`,
    );
    if (shape.clip) {
      if (!viewportClip) {
        viewportClip = document.createElementNS("http://www.w3.org/2000/svg", "clipPath");
        viewportClip.id = clipId;
        viewportClip.dataset.glassViewportClip = `${index}`;
        viewportClip.setAttribute("clipPathUnits", "userSpaceOnUse");
        viewportClip.append(document.createElementNS("http://www.w3.org/2000/svg", "rect"));
        clip.parentElement?.append(viewportClip);
      }
      const bounds = viewportClip.firstElementChild!;
      bounds.setAttribute("x", `${shape.clip.left}`);
      bounds.setAttribute("y", `${shape.clip.top}`);
      bounds.setAttribute("width", `${shape.clip.width}`);
      bounds.setAttribute("height", `${shape.clip.height}`);
      rectangle.setAttribute("clip-path", `url(#${clipId})`);
    } else {
      rectangle.removeAttribute("clip-path");
      viewportClip?.remove();
    }
  });
  rectangles.slice(shapes.length).forEach((rectangle) => rectangle.remove());
  plane
    .querySelectorAll<SVGClipPathElement>("[data-glass-viewport-clip]")
    .forEach((viewportClip) => {
      if (Number(viewportClip.dataset.glassViewportClip) >= shapes.length) viewportClip.remove();
    });
  const state = shapes.length > 0 ? "active" : "inactive";
  plane.dataset.glassBatchState = state;
  plane.dataset.sharedSmallGlassPlane = state;
}

export function readNativeGlassDiagnostics(root?: ParentNode): NativeGlassDiagnostics {
  const owner = root ?? (typeof document === "undefined" ? null : document);
  if (!owner) return emptyDiagnostics();

  const nativeSurfaces = [
    ...owner.querySelectorAll<HTMLElement>('[data-material-strategy="native-glass"]'),
  ];
  const activeIndividualSurfaces = nativeSurfaces.filter(
    (surface) => surface.dataset.materialBackdropSource !== "shared",
  );
  const activeBatches = [
    ...owner.querySelectorAll<HTMLElement>('[data-glass-batch-state="active"]'),
  ];
  const sharedSmallBatchCount = activeBatches.filter(
    (batch) => batch.dataset.glassDepth === "2",
  ).length;
  const activeDepths = new Set(activeBatches.map((batch) => batch.dataset.glassDepth));
  activeIndividualSurfaces.forEach((surface) =>
    activeDepths.add(surface.dataset.materialRole === "large" ? "1" : "2"),
  );
  const localFilterLayers = activeIndividualSurfaces.reduce(
    (count, surface) => count + individualFilterLayerCount(surface),
    0,
  );
  const batchFilterLayers = activeBatches.reduce(
    (count, batch) => count + batch.querySelectorAll("[data-native-filter-layer]").length,
    0,
  );
  return {
    activeDepthCount: activeDepths.size,
    activeGlassBatchCount: activeBatches.length,
    localMaterialBackdropFilterCount: activeIndividualSurfaces.length,
    materialGeometryRefreshesPerSecond: readMaterialGeometryRefreshesPerSecond(),
    nativeBackdropSurfaceCount: activeIndividualSurfaces.length + activeBatches.length,
    nativeBackdropFilterLayerCount: localFilterLayers + batchFilterLayers,
    sharedSmallBatchCount,
    sharedSmallPlaneActive: sharedSmallBatchCount > 0,
    temporaryDragBatchActive: activeBatches.some(
      (batch) => batch.dataset.glassBatchKind === "small-drag",
    ),
  };
}

function individualFilterLayerCount(surface: HTMLElement): number {
  const preblur = surface.querySelector<HTMLElement>(".taskmap-material-native-glass__preblur");
  const hasSteadyPreblur = preblur?.dataset.enabled === "true";
  return 1 + (hasSteadyPreblur ? 1 : 0);
}

function emptyDiagnostics(): NativeGlassDiagnostics {
  return {
    activeDepthCount: 0,
    activeGlassBatchCount: 0,
    localMaterialBackdropFilterCount: 0,
    materialGeometryRefreshesPerSecond: 0,
    nativeBackdropSurfaceCount: 0,
    nativeBackdropFilterLayerCount: 0,
    sharedSmallBatchCount: 0,
    sharedSmallPlaneActive: false,
    temporaryDragBatchActive: false,
  };
}

function assignRef(ref: ForwardedRef<HTMLDivElement>, element: HTMLDivElement | null): void {
  if (typeof ref === "function") ref(element);
  else if (ref) ref.current = element;
}
