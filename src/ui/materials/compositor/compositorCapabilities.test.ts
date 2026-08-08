// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { TransferableCacheBitmap } from "./acrylicCanvas";
import {
  detectAcrylicRuntimeCapabilities,
  type AcrylicCapabilityEnvironment,
} from "./compositorCapabilities";

class FakeOffscreenCanvas {
  readonly transferToImageBitmap = () => ({ width: 1, height: 1, close() {} });
  constructor(
    readonly width: number,
    readonly height: number,
  ) {}
  getContext(): unknown {
    return recordingContextProbe();
  }
}

function supportedEnvironment(): AcrylicCapabilityEnvironment {
  return {
    WorkerConstructor: class {},
    OffscreenCanvasConstructor: FakeOffscreenCanvas,
    createMainThreadCanvas: () => ({
      width: 1,
      height: 1,
      getContext: () => recordingContextProbe(),
    }),
    createImageBitmap: async () =>
      ({ width: 1, height: 1, close() {} }) satisfies TransferableCacheBitmap,
  };
}

describe("acrylic runtime capability selection", () => {
  it("selects the Worker OffscreenCanvas path only when every required API probes successfully", () => {
    const result = detectAcrylicRuntimeCapabilities(supportedEnvironment());
    expect(result.workerOffscreenSupported).toBe(true);
    expect(result.mainThreadFallbackSupported).toBe(true);
    expect(result.preferredMode).toBe("worker-offscreen");
  });

  it("selects main-thread fallback when Worker is unavailable", () => {
    const environment = { ...supportedEnvironment(), WorkerConstructor: undefined };
    expect(detectAcrylicRuntimeCapabilities(environment).preferredMode).toBe(
      "main-thread-fallback",
    );
  });

  it("selects main-thread fallback when OffscreenCanvas is unavailable", () => {
    const environment = { ...supportedEnvironment(), OffscreenCanvasConstructor: undefined };
    const result = detectAcrylicRuntimeCapabilities(environment);
    expect(result.offscreenCanvas2d).toBe(false);
    expect(result.preferredMode).toBe("main-thread-fallback");
  });

  it("selects overlay-only when no safe cache builder exists", () => {
    const result = detectAcrylicRuntimeCapabilities({});
    expect(result.workerOffscreenSupported).toBe(false);
    expect(result.mainThreadFallbackSupported).toBe(false);
    expect(result.preferredMode).toBe("overlay-only");
  });

  it("fails closed when a capability constructor or 2D context probe fails", () => {
    class ThrowingCanvas {
      constructor() {
        throw new Error("unsupported");
      }
    }
    const throwing = {
      ...supportedEnvironment(),
      OffscreenCanvasConstructor: ThrowingCanvas as unknown as NonNullable<
        AcrylicCapabilityEnvironment["OffscreenCanvasConstructor"]
      >,
      createMainThreadCanvas: () => {
        throw new Error("unsupported");
      },
    };
    expect(detectAcrylicRuntimeCapabilities(throwing).preferredMode).toBe("overlay-only");
  });
});

function recordingContextProbe(): Record<string, unknown> {
  const context: Record<string, unknown> = { filter: "none" };
  for (const name of [
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
  ]) {
    context[name] = () => undefined;
  }
  return context;
}
