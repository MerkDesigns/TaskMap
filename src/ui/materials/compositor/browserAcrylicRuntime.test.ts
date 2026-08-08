// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { TransferableCacheBitmap } from "./acrylicCanvas";
import type { AcrylicCacheBuildExecutor } from "./acrylicBuildExecutor";
import { createBrowserAcrylicRuntime } from "./browserAcrylicRuntime";
import type { AcrylicCapabilityEnvironment } from "./compositorCapabilities";
import { ControlledAcrylicExecutor } from "./compositorTestFixtures";

describe("browser acrylic runtime construction", () => {
  it("falls back once when the Worker constructor/executor factory fails", () => {
    const fallback = new ControlledAcrylicExecutor("main-thread-fallback");
    const createWorker = vi.fn(() => {
      throw new Error("Worker construction blocked");
    });
    const result = createBrowserAcrylicRuntime({
      capabilityEnvironment: supportedCapabilities(),
      createWorkerExecutor: createWorker,
      createMainThreadExecutor: () => asExecutor(fallback),
    });
    expect(createWorker).toHaveBeenCalledOnce();
    expect(result.runtime.getSnapshot().executionMode).toBe("main-thread-fallback");
  });

  it("does not attempt Worker creation when capability detection rejects it", () => {
    const createWorker = vi.fn();
    const fallback = new ControlledAcrylicExecutor("main-thread-fallback");
    const environment = { ...supportedCapabilities(), WorkerConstructor: undefined };
    const result = createBrowserAcrylicRuntime({
      capabilityEnvironment: environment,
      createWorkerExecutor: createWorker,
      createMainThreadExecutor: () => asExecutor(fallback),
    });
    expect(createWorker).not.toHaveBeenCalled();
    expect(result.runtime.getSnapshot().executionMode).toBe("main-thread-fallback");
  });

  it("fails closed to overlay-only if both executable paths fail construction", () => {
    const result = createBrowserAcrylicRuntime({
      capabilityEnvironment: supportedCapabilities(),
      createWorkerExecutor: () => {
        throw new Error("worker failed");
      },
      createMainThreadExecutor: () => {
        throw new Error("canvas failed");
      },
    });
    expect(result.runtime.getSnapshot()).toMatchObject({
      executionMode: "overlay-only",
      presentationMode: "overlay-only",
    });
  });
});

function supportedCapabilities(): AcrylicCapabilityEnvironment {
  const context = () => {
    const value: Record<string, unknown> = { filter: "none" };
    for (const method of [
      "setTransform",
      "clearRect",
      "fillRect",
      "save",
      "restore",
      "beginPath",
      "closePath",
      "moveTo",
      "lineTo",
      "quadraticCurveTo",
      "arc",
      "clip",
      "fill",
      "stroke",
      "drawImage",
    ])
      value[method] = () => undefined;
    return value;
  };
  return {
    WorkerConstructor: class {},
    OffscreenCanvasConstructor: class {
      constructor(
        readonly width: number,
        readonly height: number,
      ) {}
      getContext(): unknown {
        return context();
      }
      transferToImageBitmap(): TransferableCacheBitmap {
        return { width: 1, height: 1, close() {} };
      }
    },
    createMainThreadCanvas: () => ({ width: 1, height: 1, getContext: context }),
    createImageBitmap: async () => ({ width: 1, height: 1, close() {} }),
  };
}

function asExecutor(
  executor: ControlledAcrylicExecutor,
): AcrylicCacheBuildExecutor<TransferableCacheBitmap> {
  return executor as AcrylicCacheBuildExecutor<TransferableCacheBitmap>;
}
