import type { TransferableCacheBitmap } from "./acrylicCanvas";
import type { MainThreadCanvasLike } from "./mainThreadAcrylicBackend";
import type { OffscreenCanvasConstructorLike } from "./offscreenAcrylicBackend";

export type AcrylicExecutionMode = "worker-offscreen" | "main-thread-fallback" | "overlay-only";

export interface AcrylicCapabilityEnvironment {
  readonly WorkerConstructor?: unknown;
  readonly OffscreenCanvasConstructor?: OffscreenCanvasConstructorLike;
  readonly createMainThreadCanvas?: () => MainThreadCanvasLike;
  readonly createImageBitmap?: (source: object) => Promise<TransferableCacheBitmap>;
}

export interface AcrylicRuntimeCapabilities {
  readonly worker: boolean;
  readonly offscreenCanvas2d: boolean;
  readonly transferableImageBitmap: boolean;
  readonly mainThreadCanvas2d: boolean;
  readonly createImageBitmap: boolean;
  readonly workerOffscreenSupported: boolean;
  readonly mainThreadFallbackSupported: boolean;
  readonly preferredMode: AcrylicExecutionMode;
}

export function detectAcrylicRuntimeCapabilities(
  environment: AcrylicCapabilityEnvironment,
): AcrylicRuntimeCapabilities {
  const worker = typeof environment.WorkerConstructor === "function";
  const offscreenProbe = probeOffscreenCanvas(environment.OffscreenCanvasConstructor);
  const mainThreadCanvas2d = probeMainThreadCanvas(environment.createMainThreadCanvas);
  const createImageBitmap = typeof environment.createImageBitmap === "function";
  const workerOffscreenSupported =
    worker && offscreenProbe.canvas2d && offscreenProbe.transferToImageBitmap;
  const mainThreadFallbackSupported = mainThreadCanvas2d && createImageBitmap;
  return Object.freeze({
    worker,
    offscreenCanvas2d: offscreenProbe.canvas2d,
    transferableImageBitmap: offscreenProbe.transferToImageBitmap,
    mainThreadCanvas2d,
    createImageBitmap,
    workerOffscreenSupported,
    mainThreadFallbackSupported,
    preferredMode: workerOffscreenSupported
      ? "worker-offscreen"
      : mainThreadFallbackSupported
        ? "main-thread-fallback"
        : "overlay-only",
  });
}

export function createBrowserAcrylicCapabilityEnvironment(): AcrylicCapabilityEnvironment {
  const createMainThreadCanvas =
    typeof document === "undefined"
      ? undefined
      : () => document.createElement("canvas") as MainThreadCanvasLike;
  const bitmapFactory =
    typeof globalThis.createImageBitmap === "function"
      ? (source: object) => globalThis.createImageBitmap(source as ImageBitmapSource)
      : undefined;
  return Object.freeze({
    WorkerConstructor: typeof Worker === "function" ? Worker : undefined,
    OffscreenCanvasConstructor:
      typeof OffscreenCanvas === "function"
        ? (OffscreenCanvas as unknown as OffscreenCanvasConstructorLike)
        : undefined,
    createMainThreadCanvas,
    createImageBitmap: bitmapFactory,
  });
}

function probeOffscreenCanvas(Constructor: OffscreenCanvasConstructorLike | undefined): {
  readonly canvas2d: boolean;
  readonly transferToImageBitmap: boolean;
} {
  if (!Constructor) return { canvas2d: false, transferToImageBitmap: false };
  try {
    const canvas = new Constructor(1, 1);
    return {
      canvas2d: hasRequiredCanvas2d(canvas.getContext("2d")),
      transferToImageBitmap: typeof canvas.transferToImageBitmap === "function",
    };
  } catch {
    return { canvas2d: false, transferToImageBitmap: false };
  }
}

function probeMainThreadCanvas(factory: (() => MainThreadCanvasLike) | undefined): boolean {
  if (!factory) return false;
  try {
    return hasRequiredCanvas2d(factory().getContext("2d"));
  } catch {
    return false;
  }
}

function hasRequiredCanvas2d(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const context = value as Record<string, unknown>;
  const methods = [
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
  ];
  return (
    typeof context.filter === "string" &&
    methods.every((method) => typeof context[method] === "function")
  );
}
