import type { TransferableCacheBitmap } from "./acrylicCanvas";
import { createAcrylicCacheRuntime, type AcrylicCacheRuntime } from "./acrylicCacheRuntime";
import type { AcrylicCacheBuildExecutor } from "./acrylicBuildExecutor";
import { createAcrylicModuleWorker } from "./acrylicWorkerFactory";
import { createAcrylicWorkerExecutor, createWorkerPort } from "./acrylicWorkerExecutor";
import {
  createBrowserAcrylicCapabilityEnvironment,
  detectAcrylicRuntimeCapabilities,
  type AcrylicCapabilityEnvironment,
  type AcrylicRuntimeCapabilities,
} from "./compositorCapabilities";
import {
  createMainThreadAcrylicBackend,
  type MainThreadAcrylicEnvironment,
} from "./mainThreadAcrylicBackend";
import { createMainThreadAcrylicExecutor } from "./mainThreadAcrylicExecutor";

export interface BrowserAcrylicRuntime {
  readonly capabilities: AcrylicRuntimeCapabilities;
  readonly runtime: AcrylicCacheRuntime<TransferableCacheBitmap>;
}

export interface BrowserAcrylicRuntimeDependencies {
  readonly capabilityEnvironment?: AcrylicCapabilityEnvironment;
  readonly createWorkerExecutor?: () => AcrylicCacheBuildExecutor<TransferableCacheBitmap>;
  readonly createMainThreadExecutor?: () => AcrylicCacheBuildExecutor<TransferableCacheBitmap>;
}

export function createBrowserAcrylicRuntime(
  dependencies: BrowserAcrylicRuntimeDependencies = {},
): BrowserAcrylicRuntime {
  const environment =
    dependencies.capabilityEnvironment ?? createBrowserAcrylicCapabilityEnvironment();
  const capabilities = detectAcrylicRuntimeCapabilities(environment);
  const mainThreadExecutor = capabilities.mainThreadFallbackSupported
    ? createFallbackExecutor(dependencies, environment)
    : undefined;
  let workerExecutor: AcrylicCacheBuildExecutor<TransferableCacheBitmap> | undefined;
  if (capabilities.workerOffscreenSupported) {
    try {
      workerExecutor = dependencies.createWorkerExecutor
        ? dependencies.createWorkerExecutor()
        : createAcrylicWorkerExecutor(createWorkerPort(createAcrylicModuleWorker()));
    } catch {
      workerExecutor = undefined;
    }
  }

  return Object.freeze({
    capabilities,
    runtime: createAcrylicCacheRuntime({ workerExecutor, mainThreadExecutor }),
  });
}

function createFallbackExecutor(
  dependencies: BrowserAcrylicRuntimeDependencies,
  environment: AcrylicCapabilityEnvironment,
): AcrylicCacheBuildExecutor<TransferableCacheBitmap> | undefined {
  try {
    if (dependencies.createMainThreadExecutor) return dependencies.createMainThreadExecutor();
    if (!environment.createMainThreadCanvas || !environment.createImageBitmap) return undefined;
    const mainThreadEnvironment: MainThreadAcrylicEnvironment = {
      createCanvas: environment.createMainThreadCanvas,
      createImageBitmap: environment.createImageBitmap,
    };
    return createMainThreadAcrylicExecutor(createMainThreadAcrylicBackend(mainThreadEnvironment));
  } catch {
    return undefined;
  }
}
