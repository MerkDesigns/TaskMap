import { createOffscreenAcrylicBackend } from "./offscreenAcrylicBackend";
import { buildSharedAcrylicCache } from "./sharedAcrylicCacheBuilder";
import { processAcrylicWorkerMessage } from "./acrylicWorkerRuntime";

interface AcrylicWorkerScope {
  onmessage: ((event: { readonly data: unknown }) => void) | null;
  postMessage(message: object, transfer?: readonly object[]): void;
}

const workerScope = self as unknown as AcrylicWorkerScope;

workerScope.onmessage = (event) => {
  void processAcrylicWorkerMessage(event.data, workerScope, (request) => {
    const CanvasConstructor =
      OffscreenCanvas as unknown as import("./offscreenAcrylicBackend").OffscreenCanvasConstructorLike;
    return buildSharedAcrylicCache(
      request.descriptor,
      request.scene,
      createOffscreenAcrylicBackend(CanvasConstructor),
    );
  });
};
