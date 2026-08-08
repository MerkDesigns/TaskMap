import type { CanvasSize } from "../../../canvas/geometry/canvasGeometry";
import type { TransferableCacheBitmap } from "./acrylicCanvas";
import type { DisposableCacheResource } from "./compositorTypes";

export interface AcrylicBitmapResource<
  Bitmap extends TransferableCacheBitmap,
> extends DisposableCacheResource {
  readonly bitmap: Bitmap;
  readonly backingSize: CanvasSize;
  readonly closed: boolean;
}

export function createAcrylicBitmapResource<Bitmap extends TransferableCacheBitmap>(
  bitmap: Bitmap,
): AcrylicBitmapResource<Bitmap> {
  let closed = false;
  return Object.freeze({
    bitmap,
    backingSize: Object.freeze({ width: bitmap.width, height: bitmap.height }),
    get closed() {
      return closed;
    },
    close() {
      if (closed) return;
      closed = true;
      bitmap.close();
    },
  });
}
