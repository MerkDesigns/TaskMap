export interface LiquidCaptureProbe {
  readonly available: boolean;
  dispose(): void;
}

export interface LiquidCaptureSample {
  readonly width: number | null;
  readonly height: number | null;
  readonly source: unknown;
}

type CaptureReporter = (sample: LiquidCaptureSample) => void;
type CopyMethod = (this: unknown, ...arguments_: unknown[]) => unknown;

function dimensionsFromArguments(arguments_: unknown[]) {
  const currentOptions = arguments_[1];
  if (typeof currentOptions === "object" && currentOptions !== null) {
    const value = currentOptions as { width?: unknown; height?: unknown };
    return {
      width: typeof value.width === "number" ? value.width : null,
      height: typeof value.height === "number" ? value.height : null,
    };
  }
  const legacySize = arguments_[2];
  if (typeof legacySize === "object" && legacySize !== null) {
    const value = legacySize as { width?: unknown; height?: unknown };
    return {
      width: typeof value.width === "number" ? value.width : null,
      height: typeof value.height === "number" ? value.height : null,
    };
  }
  return { width: null, height: null };
}

function sourceFromArguments(arguments_: unknown[]) {
  const currentSource = arguments_[0];
  if (typeof currentSource === "object" && currentSource !== null && "source" in currentSource) {
    return (currentSource as { source?: unknown }).source;
  }
  return currentSource;
}

export function installLiquidCaptureProbe(report: CaptureReporter): LiquidCaptureProbe {
  const gpuQueue = (globalThis as typeof globalThis & { GPUQueue?: { prototype?: object } })
    .GPUQueue;
  const prototype = gpuQueue?.prototype as { copyElementImageToTexture?: CopyMethod } | undefined;
  const original = prototype?.copyElementImageToTexture;
  if (!prototype || typeof original !== "function") return { available: false, dispose() {} };

  const descriptor = Object.getOwnPropertyDescriptor(prototype, "copyElementImageToTexture");
  const wrapped: CopyMethod = function (...arguments_) {
    const { width, height } = dimensionsFromArguments(arguments_);
    report({ width, height, source: sourceFromArguments(arguments_) });
    return original.apply(this, arguments_);
  };

  try {
    Object.defineProperty(prototype, "copyElementImageToTexture", {
      ...descriptor,
      configurable: true,
      writable: true,
      value: wrapped,
    });
  } catch {
    return { available: false, dispose() {} };
  }

  return {
    available: true,
    dispose() {
      if (prototype.copyElementImageToTexture !== wrapped) return;
      if (descriptor) Object.defineProperty(prototype, "copyElementImageToTexture", descriptor);
      else delete prototype.copyElementImageToTexture;
    },
  };
}
