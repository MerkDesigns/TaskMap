import type {
  AcrylicBitmapFactory,
  AcrylicCanvasFactory,
  TransferableCacheBitmap,
} from "./acrylicCanvas";
import type { BackdropScene } from "./backdropScene";
import type { CacheBuildDescriptor } from "./compositorTypes";
import { rasterizeBackdropScene } from "./sceneRasterizer";
import { sharedAcrylicFilter, SHARED_ACRYLIC_PROFILE_REVISION } from "./sharedAcrylicProfile";

export interface SharedAcrylicCacheBackend<Bitmap extends TransferableCacheBitmap> {
  readonly canvases: AcrylicCanvasFactory;
  readonly bitmaps: AcrylicBitmapFactory<Bitmap>;
}

export class SharedAcrylicCacheBuildError extends Error {
  constructor(
    readonly code: "render-failed" | "bitmap-failed",
    message: string,
  ) {
    super(message);
    this.name = "SharedAcrylicCacheBuildError";
  }
}

/** Builds the sole expensive acrylic cache using separate source and filtered canvases. */
export async function buildSharedAcrylicCache<Bitmap extends TransferableCacheBitmap>(
  descriptor: CacheBuildDescriptor,
  scene: BackdropScene,
  backend: SharedAcrylicCacheBackend<Bitmap>,
): Promise<Bitmap> {
  if (descriptor.sharedProfileRevision !== SHARED_ACRYLIC_PROFILE_REVISION) {
    throw new Error("Cache descriptor does not target the shared acrylic profile revision");
  }

  const { width, height } = descriptor.anchor.cacheBackingSize;
  let filtered;
  try {
    const source = backend.canvases.create(width, height, false);
    rasterizeBackdropScene(source, descriptor, scene);
    filtered = backend.canvases.create(width, height, true);
    const filter = sharedAcrylicFilter(descriptor.anchor.cacheScale);
    filtered.context.setTransform(1, 0, 0, 1, 0, 0);
    filtered.context.clearRect(0, 0, width, height);
    filtered.context.filter = filter.canvasFilter;
    filtered.context.drawImage(source.imageSource, 0, 0);
    filtered.context.filter = "none";
  } catch {
    throw new SharedAcrylicCacheBuildError("render-failed", "Shared acrylic scene render failed");
  }

  try {
    const bitmap = await backend.bitmaps.create(filtered);
    if (bitmap.width !== width || bitmap.height !== height) {
      bitmap.close();
      throw new RangeError("dimensions");
    }
    return bitmap;
  } catch {
    throw new SharedAcrylicCacheBuildError(
      "bitmap-failed",
      "Shared acrylic bitmap creation or dimensions validation failed",
    );
  }
}
