import type {
  AcrylicCanvasFactory,
  AcrylicCanvasSurface,
  TransferableCacheBitmap,
} from "./acrylicCanvas";
import type { SharedAcrylicCacheBackend } from "./sharedAcrylicCacheBuilder";

export interface OffscreenCanvasLike {
  readonly width: number;
  readonly height: number;
  getContext(contextId: "2d", options?: { readonly alpha?: boolean }): unknown;
  transferToImageBitmap(): TransferableCacheBitmap;
}

export interface OffscreenCanvasConstructorLike {
  new (width: number, height: number): OffscreenCanvasLike;
}

export function createOffscreenAcrylicBackend(
  CanvasConstructor: OffscreenCanvasConstructorLike,
): SharedAcrylicCacheBackend<TransferableCacheBitmap> {
  const canvasesBySurface = new WeakMap<AcrylicCanvasSurface, OffscreenCanvasLike>();
  const canvases: AcrylicCanvasFactory = Object.freeze({
    create(width: number, height: number, alpha: boolean) {
      const canvas = new CanvasConstructor(width, height);
      const context = canvas.getContext("2d", { alpha });
      if (!context) throw new Error("OffscreenCanvas 2D context is unavailable");
      const surface: AcrylicCanvasSurface = Object.freeze({
        width,
        height,
        context: context as AcrylicCanvasSurface["context"],
        imageSource: canvas,
      });
      canvasesBySurface.set(surface, canvas);
      return surface;
    },
  });

  return Object.freeze({
    canvases,
    bitmaps: Object.freeze({
      create(surface: AcrylicCanvasSurface) {
        const canvas = canvasesBySurface.get(surface);
        if (!canvas)
          throw new Error("Bitmap source was not created by this OffscreenCanvas backend");
        return canvas.transferToImageBitmap();
      },
    }),
  });
}
