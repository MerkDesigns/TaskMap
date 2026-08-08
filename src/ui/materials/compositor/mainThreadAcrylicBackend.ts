import type {
  AcrylicCanvasFactory,
  AcrylicCanvasSurface,
  TransferableCacheBitmap,
} from "./acrylicCanvas";
import type { SharedAcrylicCacheBackend } from "./sharedAcrylicCacheBuilder";

export interface MainThreadCanvasLike {
  width: number;
  height: number;
  getContext(contextId: "2d", options?: { readonly alpha?: boolean }): unknown;
}

export interface MainThreadAcrylicEnvironment {
  createCanvas(): MainThreadCanvasLike;
  createImageBitmap(source: object): Promise<TransferableCacheBitmap>;
}

export function createMainThreadAcrylicBackend(
  environment: MainThreadAcrylicEnvironment,
): SharedAcrylicCacheBackend<TransferableCacheBitmap> {
  const canvasesBySurface = new WeakMap<AcrylicCanvasSurface, MainThreadCanvasLike>();
  const canvases: AcrylicCanvasFactory = Object.freeze({
    create(width: number, height: number, alpha: boolean) {
      const canvas = environment.createCanvas();
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { alpha });
      if (!context) throw new Error("Main-thread Canvas2D context is unavailable");
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
        if (!canvas) throw new Error("Bitmap source was not created by this main-thread backend");
        return environment.createImageBitmap(canvas);
      },
    }),
  });
}
