import {
  forwardRef,
  useCallback,
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
import { registerSmallOutputMask, writeSmallOutputShapes } from "./sharedSmallOutputMask";

export interface SharedSmallGlassShape {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly radius: number;
  readonly clip?: MaterialRectangle;
  /** Render `clip` as the visible silhouette with this radius (settled scroll-edge morph). */
  readonly morph?: boolean;
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
    useLayoutEffect(() => {
      const plane = planeRef.current;
      if (!plane) return;
      return registerSmallOutputMask(plane);
    }, []);
    const materialStyle = {
      ...createMaterialSurfaceStyle(ACRYLIC_SMALL, "none", ACRYLIC_SMALL.defaultRadiusPx, style),
      ...(blurPx === undefined
        ? {}
        : { "--taskmap-material-small-blur-override": `${Math.max(0, blurPx)}px` }),
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
  const state = shapes.length > 0 ? "active" : "inactive";
  plane.dataset.glassBatchState = state;
  plane.dataset.sharedSmallGlassPlane = state;
  // Masks go on the two filter outputs, never a root clip: a clipped batch root becomes a WebView2
  // backdrop root whose filters cannot sample the cards beneath.
  writeSmallOutputShapes(plane, shapes);
}

export function readNativeGlassDiagnostics(root?: ParentNode): NativeGlassDiagnostics {
  const owner = root ?? (typeof document === "undefined" ? null : document);
  if (!owner) return emptyDiagnostics();

  const nativeSurfaces = [
    ...owner.querySelectorAll<HTMLElement>('[data-material-strategy="native-glass"]'),
  ];
  const activeIndividualSurfaces = nativeSurfaces.filter(
    (surface) =>
      !["shared", "plane", "shell"].includes(surface.dataset.materialBackdropSource ?? ""),
  );
  const majorPlanes = owner.querySelectorAll("[data-major-glass-plane]");
  const activeBatches = [
    ...owner.querySelectorAll<HTMLElement>('[data-glass-batch-state="active"]'),
  ];
  const sharedSmallBatchCount = activeBatches.filter(
    (batch) => batch.dataset.glassDepth === "2",
  ).length;
  const activeDepths = new Set(activeBatches.map((batch) => batch.dataset.glassDepth));
  if (majorPlanes.length) activeDepths.add("1");
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
    activeGlassBatchCount: activeBatches.length + majorPlanes.length,
    localMaterialBackdropFilterCount: activeIndividualSurfaces.length,
    materialGeometryRefreshesPerSecond: readMaterialGeometryRefreshesPerSecond(),
    nativeBackdropSurfaceCount:
      activeIndividualSurfaces.length + activeBatches.length + majorPlanes.length,
    nativeBackdropFilterLayerCount:
      localFilterLayers +
      batchFilterLayers +
      [...majorPlanes].reduce(
        (count, plane) =>
          count +
          plane.querySelectorAll(".taskmap-native-glass-preblur, .taskmap-native-glass-backdrop")
            .length,
        0,
      ),
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
