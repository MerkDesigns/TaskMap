import type { TransferableCacheBitmap } from "./acrylicCanvas";
import { createAcrylicBitmapResource } from "./acrylicBitmapResource";
import type {
  AcrylicBuildResult,
  AcrylicCacheBuildExecutor,
  AcrylicCacheBuildPayload,
} from "./acrylicBuildExecutor";
import type { SharedAcrylicCacheBackend } from "./sharedAcrylicCacheBuilder";
import { buildSharedAcrylicCache, SharedAcrylicCacheBuildError } from "./sharedAcrylicCacheBuilder";

export function createMainThreadAcrylicExecutor(
  backend: SharedAcrylicCacheBackend<TransferableCacheBitmap>,
): AcrylicCacheBuildExecutor<TransferableCacheBitmap> {
  let disposed = false;
  let active = false;

  return Object.freeze({
    kind: "main-thread-fallback",
    start(
      payload: AcrylicCacheBuildPayload,
      complete: (result: AcrylicBuildResult<TransferableCacheBitmap>) => void,
    ) {
      if (disposed) throw new Error("Main-thread acrylic executor is disposed");
      if (active) throw new Error("Main-thread acrylic executor already has an active build");
      active = true;
      void buildSharedAcrylicCache(payload.descriptor, payload.scene, backend).then(
        (bitmap) => {
          active = false;
          const resource = createAcrylicBitmapResource(bitmap);
          if (disposed) {
            resource.close();
            return;
          }
          complete({ kind: "success", descriptor: payload.descriptor, resource });
        },
        (error) => {
          active = false;
          if (!disposed) {
            complete({
              kind: "failure",
              descriptor: payload.descriptor,
              code: error instanceof SharedAcrylicCacheBuildError ? error.code : "render-failed",
              fatal: false,
            });
          }
        },
      );
    },
    dispose() {
      disposed = true;
    },
  });
}
