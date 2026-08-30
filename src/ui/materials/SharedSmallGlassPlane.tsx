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

export interface SharedSmallGlassShape {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly radius: number;
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
  readonly shadowIds?: readonly string[];
}

export const SharedSmallGlassPlane = forwardRef<HTMLDivElement, SharedSmallGlassPlaneProps>(
  function SharedSmallGlassPlane(
    {
      batchId = "canvas-small",
      blurPx,
      className,
      kind = "small-canvas",
      shadowIds = [],
      style,
      ...props
    },
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
    } as CSSProperties;
    const backdropClipStyle = {
      clipPath: `url(#${clipId})`,
      WebkitClipPath: `url(#${clipId})`,
    } as CSSProperties;

    return (
      <div
        {...props}
        ref={composedRef}
        className={["taskmap-shared-small-glass-plane", className].filter(Boolean).join(" ")}
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
        <span className="taskmap-shared-small-glass-plane__backdrop-clip" style={backdropClipStyle}>
          <span className="taskmap-shared-small-glass-plane__preblur" data-native-filter-layer />
          <span className="taskmap-shared-small-glass-plane__backdrop" data-native-filter-layer />
        </span>
        {shadowIds.map((id) => (
          <span
            key={id}
            className="taskmap-shared-small-glass-plane__shadow"
            data-shared-small-glass-shadow={id}
            style={createMaterialSurfaceStyle(
              ACRYLIC_SMALL,
              "default",
              ACRYLIC_SMALL.defaultRadiusPx,
            )}
          />
        ))}
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
  const backdrop = plane.querySelector<HTMLElement>(".taskmap-shared-small-glass-plane__backdrop");
  const progress = "var(--taskmap-material-presence-progress, 1)";
  const blurProgress = "var(--taskmap-material-blur-presence-progress, 1)";
  const filter = `blur(calc(${blur}px * ${blurProgress})) saturate(calc(1 + (var(--taskmap-material-saturation) - 1) * ${progress})) brightness(calc(1 + (var(--taskmap-material-brightness) - 1) * ${progress})) contrast(calc(1 + (var(--taskmap-material-contrast) - 1) * ${progress}))`;
  backdrop?.style.setProperty("-webkit-backdrop-filter", filter);
  backdrop?.style.setProperty("backdrop-filter", filter);
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
  });
  rectangles.slice(shapes.length).forEach((rectangle) => rectangle.remove());
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
  const hasInteractionPreblur =
    surface.dataset.materialMotion === "active" && preblur?.dataset.interactionEnabled === "true";
  return 1 + (hasSteadyPreblur || hasInteractionPreblur ? 1 : 0);
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
