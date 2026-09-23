import {
  readSuppliedMaterialSurfaceSize,
  subscribeMaterialSurfaceGeometryInvalidation,
  subscribeMaterialSurfaceSize,
} from "./materialGeometryInvalidation";
import { registerMaterialGeometryWork, type MaterialSize } from "./materialGeometryScheduler";
import { recordMaterialGeometryRefresh } from "./materialPerformanceDiagnostics";
import {
  calculateMaterialOverscan,
  viewportMaterialBoundary,
  writeMaterialOverscan,
} from "./materialSamplingBoundary";
import type { NativeGlassMaterialDefinition } from "./materialTypes";
import { drawNativeGlassRim } from "./nativeGlassRim";

export function registerNativeGlassGeometry({
  element,
  canvas,
  definition,
  radius,
  shared,
  owned,
  samplingElement,
}: {
  element: HTMLElement;
  canvas: HTMLCanvasElement | null;
  definition: NativeGlassMaterialDefinition;
  radius: number;
  shared: boolean;
  owned: boolean;
  samplingElement: () => HTMLElement | null;
}): () => void {
  let rimKey = "";
  let optics: { devicePixelRatio: number; borderBrightness: number } | undefined;
  const prepareRimWrite = (size: MaterialSize) => {
    if (!optics) return;
    const { devicePixelRatio, borderBrightness } = optics;
    const key = `${size.width}:${size.height}:${radius}:${devicePixelRatio}:${borderBrightness}`;
    return () => {
      if (!canvas || key === rimKey) return;
      rimKey = key;
      drawNativeGlassRim(canvas, {
        ...size,
        radiusPx: radius,
        devicePixelRatio,
        rim: { ...definition.rim, exposure: definition.rim.exposure * borderBrightness },
      });
    };
  };
  const geometry = registerMaterialGeometryWork(
    {
      scrollRoot: shared ? undefined : element,
      read(frame) {
        const boundary = samplingElement();
        geometry.observe(owned ? [] : boundary ? [element, boundary] : [element]);
        const size = owned ? readSuppliedMaterialSurfaceSize(element) : frame.size(element);
        if (!size) return;
        recordMaterialGeometryRefresh();
        const style = frame.style(element);
        const blur = Number.parseFloat(style.getPropertyValue("--taskmap-material-effective-blur"));
        const brightness = Number.parseFloat(
          style.getPropertyValue("--taskmap-material-effective-border-brightness"),
        );
        const borderBrightness = Number.isFinite(brightness) ? Math.max(0, brightness) : 1;
        const overscan = shared
          ? null
          : calculateMaterialOverscan(
              frame.rectangle(element),
              boundary ? frame.rectangle(boundary) : viewportMaterialBoundary(),
              ((Number.isFinite(blur) ? blur : definition.blurPx) + (definition.preblurPx ?? 0)) *
                definition.overscanRatio,
            );
        optics = { devicePixelRatio: window.devicePixelRatio, borderBrightness };
        const writeRim = prepareRimWrite(size);
        return () => {
          if (overscan) writeMaterialOverscan(element, overscan);
          writeRim?.();
        };
      },
    },
    owned ? [] : [element],
  );
  const unsubscribe = subscribeMaterialSurfaceGeometryInvalidation(element, geometry.invalidate);
  const unsubscribeSize = owned
    ? subscribeMaterialSurfaceSize(element, prepareRimWrite)
    : undefined;
  return () => {
    unsubscribe();
    unsubscribeSize?.();
    geometry.dispose();
  };
}
