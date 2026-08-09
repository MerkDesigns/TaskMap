import type { TransferableCacheBitmap } from "./acrylicCanvas";
import type { AcrylicBitmapResource } from "./acrylicBitmapResource";
import type {
  AcrylicBuildFailureCode,
  AcrylicBuildResult,
  AcrylicCacheBuildExecutor,
  AcrylicCacheBuildPayload,
} from "./acrylicBuildExecutor";
import { parseBackdropScene } from "./backdropSceneValidation";
import { createCacheResourceOwner, type AcceptedCacheResource } from "./cacheResourceOwner";
import {
  completeCacheBuild,
  createCacheSchedulerState,
  disposeCacheScheduler,
  requestCacheBuild,
  type CacheSchedulerState,
} from "./cacheScheduler";
import type { CacheBuildDescriptor } from "./compositorTypes";
import { cacheBuildDescriptorsEqual, sameCacheBuildRequestIdentity } from "./compositorTypes";
import type { AcrylicExecutionMode } from "./compositorCapabilities";

export type AcrylicPresentationMode = "acrylic-cache" | "overlay-only";

export interface AcrylicCacheRuntimeSnapshot<Bitmap extends TransferableCacheBitmap> {
  readonly executionMode: AcrylicExecutionMode;
  readonly presentationMode: AcrylicPresentationMode;
  readonly interactionActive: boolean;
  readonly deferred: boolean;
  readonly scheduler: CacheSchedulerState;
  readonly accepted: AcceptedCacheResource<AcrylicBitmapResource<Bitmap>> | null;
  readonly lastFailure: AcrylicBuildFailureCode | null;
}

export interface AcrylicCacheRuntime<Bitmap extends TransferableCacheBitmap> {
  request(descriptor: CacheBuildDescriptor, scene: unknown): void;
  setInteractionActive(active: boolean): void;
  getSnapshot(): AcrylicCacheRuntimeSnapshot<Bitmap>;
  subscribe(listener: () => void): () => void;
  dispose(): void;
}

export interface AcrylicCacheRuntimeOptions<Bitmap extends TransferableCacheBitmap> {
  readonly workerExecutor?: AcrylicCacheBuildExecutor<Bitmap>;
  readonly mainThreadExecutor?: AcrylicCacheBuildExecutor<Bitmap>;
  readonly interactionActive?: boolean;
}

export function createAcrylicCacheRuntime<Bitmap extends TransferableCacheBitmap>(
  options: AcrylicCacheRuntimeOptions<Bitmap>,
): AcrylicCacheRuntime<Bitmap> {
  let disposed = false;
  let scheduler = createCacheSchedulerState();
  let activePayload: AcrylicCacheBuildPayload | null = null;
  let queuedPayload: AcrylicCacheBuildPayload | null = null;
  let activeStarted = false;
  let interactionActive = options.interactionActive ?? false;
  let workerExecutor = options.workerExecutor ?? null;
  const mainThreadExecutor = options.mainThreadExecutor ?? null;
  let executionMode: AcrylicExecutionMode = workerExecutor
    ? "worker-offscreen"
    : mainThreadExecutor
      ? "main-thread-fallback"
      : "overlay-only";
  let lastFailure: AcrylicBuildFailureCode | null = null;
  const resources = createCacheResourceOwner<AcrylicBitmapResource<Bitmap>>();
  const listeners = new Set<() => void>();
  const publish = () => listeners.forEach((listener) => listener());

  const currentExecutor = (): AcrylicCacheBuildExecutor<Bitmap> | null =>
    executionMode === "worker-offscreen"
      ? workerExecutor
      : executionMode === "main-thread-fallback"
        ? mainThreadExecutor
        : null;

  const downgradeWorker = () => {
    workerExecutor?.dispose();
    workerExecutor = null;
    executionMode = mainThreadExecutor ? "main-thread-fallback" : "overlay-only";
  };

  const finish = (result: AcrylicBuildResult<Bitmap>) => {
    if (disposed) {
      if (result.kind === "success") resources.reject(result.resource);
      return;
    }
    const wasActive = Boolean(
      scheduler.active && sameCacheBuildRequestIdentity(scheduler.active, result.descriptor),
    );
    const fatalWorkerFailure =
      wasActive &&
      result.kind === "failure" &&
      result.fatal &&
      executionMode === "worker-offscreen";

    if (fatalWorkerFailure) {
      lastFailure = result.code;
      downgradeWorker();
      if (
        mainThreadExecutor &&
        scheduler.desired &&
        cacheBuildDescriptorsEqual(result.descriptor, scheduler.desired)
      ) {
        activeStarted = false;
        startActiveBuild();
        publish();
        return;
      }
    }

    const completion = completeCacheBuild(scheduler, result.descriptor);
    if (result.kind === "success") {
      if (completion.decision === "accept") {
        resources.accept(result.descriptor, result.resource);
      } else {
        resources.reject(result.resource);
      }
    }
    if (!wasActive) return;

    if (result.kind === "failure") {
      lastFailure = result.code;
    } else {
      lastFailure = null;
    }
    scheduler = completion.state;
    activeStarted = false;
    activePayload = completion.buildToStart ? queuedPayload : null;
    queuedPayload = null;
    startActiveBuild();
    publish();
  };

  const skipUnavailableBuild = () => {
    if (!activePayload) return;
    finish({
      kind: "failure",
      descriptor: activePayload.descriptor,
      code: "render-failed",
      fatal: false,
    });
  };

  const skipObsoleteDeferredBuild = () => {
    if (!activePayload) return;
    const completion = completeCacheBuild(scheduler, activePayload.descriptor);
    scheduler = completion.state;
    activeStarted = false;
    activePayload = completion.buildToStart ? queuedPayload : null;
    queuedPayload = null;
    startActiveBuild();
  };

  const startActiveBuild = () => {
    if (disposed || activeStarted || !activePayload) return;
    if (executionMode === "main-thread-fallback" && interactionActive) {
      return;
    }
    if (
      scheduler.desired &&
      !cacheBuildDescriptorsEqual(activePayload.descriptor, scheduler.desired)
    ) {
      skipObsoleteDeferredBuild();
      return;
    }
    const executor = currentExecutor();
    if (!executor) {
      skipUnavailableBuild();
      return;
    }
    activeStarted = true;
    try {
      executor.start(activePayload, finish);
    } catch {
      finish({
        kind: "failure",
        descriptor: activePayload.descriptor,
        code: executor.kind === "worker-offscreen" ? "worker-error" : "render-failed",
        fatal: executor.kind === "worker-offscreen",
      });
    }
  };

  return Object.freeze({
    request(descriptor: CacheBuildDescriptor, sceneValue: unknown) {
      if (disposed) return;
      const transition = requestCacheBuild(scheduler, descriptor);
      if (transition.state === scheduler) return;
      const scene = parseBackdropScene(sceneValue);
      if (
        scene.identity.key !== descriptor.scene.key ||
        scene.identity.revision !== descriptor.scene.revision
      ) {
        throw new Error("Backdrop scene identity must match its cache build descriptor");
      }
      const payload = Object.freeze({ descriptor, scene });
      scheduler = transition.state;
      if (transition.buildToStart) {
        activePayload = payload;
        activeStarted = false;
        startActiveBuild();
      } else {
        queuedPayload = payload;
      }
      publish();
    },
    setInteractionActive(active: boolean) {
      if (disposed || interactionActive === active) return;
      interactionActive = active;
      if (!interactionActive) startActiveBuild();
      publish();
    },
    getSnapshot() {
      const accepted = resources.getAccepted();
      return Object.freeze({
        executionMode,
        presentationMode: accepted ? "acrylic-cache" : "overlay-only",
        interactionActive,
        deferred: Boolean(activePayload && !activeStarted),
        scheduler,
        accepted,
        lastFailure,
      });
    },
    subscribe(listener: () => void) {
      if (disposed) return () => undefined;
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      scheduler = disposeCacheScheduler(scheduler);
      activePayload = null;
      queuedPayload = null;
      activeStarted = false;
      workerExecutor?.dispose();
      mainThreadExecutor?.dispose();
      resources.dispose();
      executionMode = "overlay-only";
      listeners.clear();
    },
  });
}
