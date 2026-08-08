import type { TransferableCacheBitmap } from "./acrylicCanvas";
import type { AcrylicBitmapResource } from "./acrylicBitmapResource";
import type { BackdropScene } from "./backdropScene";
import type { CacheBuildDescriptor } from "./compositorTypes";

export interface AcrylicCacheBuildPayload {
  readonly descriptor: CacheBuildDescriptor;
  readonly scene: BackdropScene;
}

export type AcrylicBuildFailureCode =
  | "invalid-request"
  | "render-failed"
  | "bitmap-failed"
  | "malformed-result"
  | "worker-error"
  | "worker-post-failed";

export type AcrylicBuildResult<Bitmap extends TransferableCacheBitmap> =
  | {
      readonly kind: "success";
      readonly descriptor: CacheBuildDescriptor;
      readonly resource: AcrylicBitmapResource<Bitmap>;
    }
  | {
      readonly kind: "failure";
      readonly descriptor: CacheBuildDescriptor;
      readonly code: AcrylicBuildFailureCode;
      readonly fatal: boolean;
    };

export interface AcrylicCacheBuildExecutor<Bitmap extends TransferableCacheBitmap> {
  readonly kind: "worker-offscreen" | "main-thread-fallback";
  start(
    payload: AcrylicCacheBuildPayload,
    complete: (result: AcrylicBuildResult<Bitmap>) => void,
  ): void;
  dispose(): void;
}
