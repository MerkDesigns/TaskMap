import type { CanvasRectangle, CanvasSize } from "../../../canvas/geometry/canvasGeometry";
import type { CanvasViewport } from "../../../canvas/geometry/viewportMath";
import type { AcrylicBitmapResource } from "./acrylicBitmapResource";
import type { TransferableCacheBitmap } from "./acrylicCanvas";
import { calculateCacheReprojection } from "./cacheReprojection";
import type { AcceptedCacheResource } from "./cacheResourceOwner";

export interface CompositorMaskSurface {
  readonly bounds: CanvasRectangle;
  readonly maskOpacity: number;
  readonly radiusPx: number;
  readonly visible: boolean;
}

export type CompositorPlane = "base" | "modal";

export interface CompositorOutputPlaneSet {
  resize(viewportCssSize: CanvasSize, backingSize: CanvasSize): void;
  rebuildMask(
    plane: CompositorPlane,
    surfaces: readonly CompositorMaskSurface[],
    compositeScale: number,
  ): void;
  compose(
    accepted: AcceptedCacheResource<AcrylicBitmapResource<TransferableCacheBitmap>> | null,
    viewport: CanvasViewport,
  ): void;
  clear(): void;
  dispose(): void;
}

export interface CompositorCanvasFactory {
  create(width: number, height: number): HTMLCanvasElement;
}

export function createCompositorOutputPlaneSet(
  canvases: Readonly<Record<CompositorPlane, HTMLCanvasElement>>,
  factory: CompositorCanvasFactory = browserCanvasFactory(),
): CompositorOutputPlaneSet {
  let disposed = false;
  let backingSize: CanvasSize = Object.freeze({ width: 1, height: 1 });
  const masks = {
    base: factory.create(1, 1),
    modal: factory.create(1, 1),
  } satisfies Record<CompositorPlane, HTMLCanvasElement>;
  const outputContexts = {
    base: requireContext(canvases.base),
    modal: requireContext(canvases.modal),
  } satisfies Record<CompositorPlane, CanvasRenderingContext2D>;
  const maskContexts = {
    base: requireContext(masks.base),
    modal: requireContext(masks.modal),
  } satisfies Record<CompositorPlane, CanvasRenderingContext2D>;

  const clearPlane = (plane: CompositorPlane) => {
    const context = outputContexts[plane];
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, backingSize.width, backingSize.height);
  };

  return Object.freeze({
    resize(viewportCssSize: CanvasSize, nextBackingSize: CanvasSize) {
      if (disposed) return;
      backingSize = Object.freeze({ ...nextBackingSize });
      for (const plane of planes()) {
        const output = canvases[plane];
        const mask = masks[plane];
        output.width = nextBackingSize.width;
        output.height = nextBackingSize.height;
        output.style.width = `${viewportCssSize.width}px`;
        output.style.height = `${viewportCssSize.height}px`;
        mask.width = nextBackingSize.width;
        mask.height = nextBackingSize.height;
      }
    },
    rebuildMask(
      plane: CompositorPlane,
      surfaces: readonly CompositorMaskSurface[],
      compositeScale: number,
    ) {
      if (disposed) return;
      const context = maskContexts[plane];
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, backingSize.width, backingSize.height);
      context.fillStyle = "#fff";
      context.setTransform(compositeScale, 0, 0, compositeScale, 0, 0);
      for (const surface of surfaces) {
        if (!surface.visible || surface.maskOpacity <= 0) continue;
        context.globalAlpha = surface.maskOpacity;
        roundedMaskPath(context, surface.bounds, surface.radiusPx);
        context.fill();
      }
      context.globalAlpha = 1;
      context.setTransform(1, 0, 0, 1, 0, 0);
    },
    compose(
      accepted: AcceptedCacheResource<AcrylicBitmapResource<TransferableCacheBitmap>> | null,
      viewport: CanvasViewport,
    ) {
      if (disposed) return;
      for (const plane of planes()) {
        clearPlane(plane);
        if (!accepted) continue;
        const context = outputContexts[plane];
        const projection = calculateCacheReprojection(accepted.descriptor, viewport, backingSize);
        context.save();
        context.drawImage(
          accepted.resource.bitmap as unknown as CanvasImageSource,
          projection.source.x,
          projection.source.y,
          projection.source.width,
          projection.source.height,
          projection.destination.x,
          projection.destination.y,
          projection.destination.width,
          projection.destination.height,
        );
        context.globalCompositeOperation = "destination-in";
        context.drawImage(masks[plane], 0, 0);
        context.restore();
      }
    },
    clear() {
      if (disposed) return;
      planes().forEach(clearPlane);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const plane of planes()) {
        canvases[plane].width = 1;
        canvases[plane].height = 1;
        masks[plane].width = 1;
        masks[plane].height = 1;
      }
    },
  });
}

function roundedMaskPath(
  context: CanvasRenderingContext2D,
  bounds: CanvasRectangle,
  requestedRadius: number,
): void {
  const radius = Math.max(0, Math.min(requestedRadius, bounds.width / 2, bounds.height / 2));
  const right = bounds.x + bounds.width;
  const bottom = bounds.y + bounds.height;
  context.beginPath();
  context.moveTo(bounds.x + radius, bounds.y);
  context.lineTo(right - radius, bounds.y);
  context.quadraticCurveTo(right, bounds.y, right, bounds.y + radius);
  context.lineTo(right, bottom - radius);
  context.quadraticCurveTo(right, bottom, right - radius, bottom);
  context.lineTo(bounds.x + radius, bottom);
  context.quadraticCurveTo(bounds.x, bottom, bounds.x, bottom - radius);
  context.lineTo(bounds.x, bounds.y + radius);
  context.quadraticCurveTo(bounds.x, bounds.y, bounds.x + radius, bounds.y);
  context.closePath();
}

function requireContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Acrylic compositor output requires Canvas2D");
  return context;
}

function browserCanvasFactory(): CompositorCanvasFactory {
  return {
    create(width, height) {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      return canvas;
    },
  };
}

function planes(): readonly CompositorPlane[] {
  return ["base", "modal"];
}
