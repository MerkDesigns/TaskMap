import { forwardRef, type HTMLAttributes } from "react";
import {
  NativeGlassBatch,
  writeNativeGlassBatchShapes,
  type NativeGlassBatchShape,
} from "./NativeGlassBatch";
import { readMaterialGeometryRefreshesPerSecond } from "./materialPerformanceDiagnostics";

export type SharedSmallGlassShape = NativeGlassBatchShape;

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
  readonly kind?: "small-canvas" | "small-extension";
}

export const SharedSmallGlassPlane = forwardRef<HTMLDivElement, SharedSmallGlassPlaneProps>(
  function SharedSmallGlassPlane(
    { batchId = "canvas-small", className, kind = "small-canvas", ...props },
    ref,
  ) {
    return (
      <NativeGlassBatch
        {...props}
        ref={ref}
        material="acrylic-small"
        depth={2}
        kind={kind}
        batchId={batchId}
        data-shared-small-glass-plane="inactive"
        className={["taskmap-shared-small-glass-plane", className].filter(Boolean).join(" ")}
      />
    );
  },
);

export function writeSharedSmallGlassShapes(
  plane: HTMLElement,
  shapes: readonly SharedSmallGlassShape[],
): void {
  writeNativeGlassBatchShapes(plane, shapes);
  plane.dataset.sharedSmallGlassPlane = shapes.length > 0 ? "active" : "inactive";
}

export function readNativeGlassDiagnostics(root?: ParentNode): NativeGlassDiagnostics {
  const owner = root ?? (typeof document === "undefined" ? null : document);
  if (!owner) {
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
  const activeDepthCount = new Set(activeBatches.map((batch) => batch.dataset.glassDepth)).size;
  const localFilterLayers = activeIndividualSurfaces.reduce(
    (count, surface) =>
      count +
      1 +
      (surface.querySelector('.taskmap-material-native-glass__preblur[data-enabled="true"]') ||
      surface.querySelector(
        '.taskmap-material-native-glass__preblur[data-interaction-enabled="true"]',
      )
        ? 1
        : 0),
    0,
  );
  const batchFilterLayers = activeBatches.reduce(
    (count, batch) => count + batch.querySelectorAll("[data-native-filter-layer]").length,
    0,
  );
  return {
    activeDepthCount,
    activeGlassBatchCount: activeBatches.length,
    localMaterialBackdropFilterCount: activeIndividualSurfaces.length,
    materialGeometryRefreshesPerSecond: readMaterialGeometryRefreshesPerSecond(),
    nativeBackdropSurfaceCount: activeIndividualSurfaces.length + activeBatches.length,
    nativeBackdropFilterLayerCount: localFilterLayers + batchFilterLayers,
    sharedSmallBatchCount,
    sharedSmallPlaneActive: sharedSmallBatchCount > 0,
    temporaryDragBatchActive: owner.querySelector("[data-glass-drag-region-active]") !== null,
  };
}
