import type { TransferableCacheBitmap } from "./acrylicCanvas";
import { createAcrylicBitmapResource } from "./acrylicBitmapResource";
import type {
  AcrylicBuildResult,
  AcrylicCacheBuildExecutor,
  AcrylicCacheBuildPayload,
} from "./acrylicBuildExecutor";
import {
  createAcrylicWorkerBuildRequest,
  isTransferableCacheBitmap,
  parseAcrylicWorkerResponse,
  readBitmapFromMalformedResponse,
} from "./acrylicWorkerProtocol";
import { cacheBuildDescriptorsEqual, compareCacheBuildRequestIdentity } from "./compositorTypes";

export interface AcrylicWorkerPort {
  postMessage(message: object): void;
  listen(onMessage: (data: unknown) => void, onError: () => void): void;
  terminate(): void;
}

interface PendingWorkerBuild {
  readonly payload: AcrylicCacheBuildPayload;
  readonly complete: (result: AcrylicBuildResult<TransferableCacheBitmap>) => void;
}

export function createAcrylicWorkerExecutor(
  port: AcrylicWorkerPort,
): AcrylicCacheBuildExecutor<TransferableCacheBitmap> {
  let disposed = false;
  let failed = false;
  let terminated = false;
  let pending: PendingWorkerBuild | null = null;
  const closedBitmaps = new WeakSet<TransferableCacheBitmap>();

  const closeBitmapOnce = (bitmap: TransferableCacheBitmap) => {
    if (closedBitmaps.has(bitmap)) return;
    closedBitmaps.add(bitmap);
    bitmap.close();
  };

  const terminateOnce = () => {
    if (terminated) return;
    terminated = true;
    port.terminate();
  };

  const failPending = (code: "malformed-result" | "worker-error" | "worker-post-failed") => {
    failed = true;
    terminateOnce();
    const current = pending;
    pending = null;
    if (current) {
      current.complete({
        kind: "failure",
        descriptor: current.payload.descriptor,
        code,
        fatal: true,
      });
    }
  };

  port.listen(
    (value) => {
      const malformedBitmap = readBitmapFromMalformedResponse(value);
      if (disposed) {
        if (malformedBitmap) closeBitmapOnce(malformedBitmap);
        return;
      }
      let response;
      try {
        response = parseAcrylicWorkerResponse(value, isTransferableCacheBitmap);
      } catch {
        if (malformedBitmap) closeBitmapOnce(malformedBitmap);
        failPending("malformed-result");
        return;
      }

      const current = pending;
      if (!current) {
        if (response.type === "success") closeBitmapOnce(response.bitmap);
        return;
      }
      if (response.type === "failure") {
        const order = compareCacheBuildRequestIdentity(
          response.request,
          current.payload.descriptor.request,
        );
        if (order < 0) return;
        if (order > 0) {
          failPending("malformed-result");
          return;
        }
        failed = true;
        pending = null;
        terminateOnce();
        current.complete({
          kind: "failure",
          descriptor: current.payload.descriptor,
          code: response.code,
          fatal: true,
        });
        return;
      }
      if (!cacheBuildDescriptorsEqual(response.descriptor, current.payload.descriptor)) {
        closeBitmapOnce(response.bitmap);
        const order = compareCacheBuildRequestIdentity(
          response.descriptor.request,
          current.payload.descriptor.request,
        );
        if (order < 0) return;
        failPending("malformed-result");
        return;
      }
      const expectedSize = current.payload.descriptor.anchor.cacheBackingSize;
      if (
        response.bitmap.width !== expectedSize.width ||
        response.bitmap.height !== expectedSize.height
      ) {
        closeBitmapOnce(response.bitmap);
        failPending("malformed-result");
        return;
      }
      pending = null;
      current.complete({
        kind: "success",
        descriptor: response.descriptor,
        resource: createAcrylicBitmapResource(response.bitmap),
      });
    },
    () => {
      if (!disposed) failPending("worker-error");
    },
  );

  return Object.freeze({
    kind: "worker-offscreen",
    start(
      payload: AcrylicCacheBuildPayload,
      complete: (result: AcrylicBuildResult<TransferableCacheBitmap>) => void,
    ) {
      if (disposed || failed) throw new Error("Acrylic worker executor is unavailable");
      if (pending) throw new Error("Acrylic worker executor already has an active build");
      pending = Object.freeze({ payload, complete });
      try {
        port.postMessage(createAcrylicWorkerBuildRequest(payload.descriptor, payload.scene));
      } catch {
        failPending("worker-post-failed");
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      pending = null;
      terminateOnce();
    },
  });
}

export function createWorkerPort(worker: Worker): AcrylicWorkerPort {
  return Object.freeze({
    postMessage(message: object) {
      worker.postMessage(message);
    },
    listen(onMessage: (data: unknown) => void, onError: () => void) {
      const messageListener = (event: MessageEvent<unknown>) => onMessage(event.data);
      const errorListener = () => onError();
      worker.addEventListener("message", messageListener);
      worker.addEventListener("error", errorListener);
    },
    terminate() {
      worker.terminate();
    },
  });
}
