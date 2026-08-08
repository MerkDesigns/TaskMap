// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { AcrylicCanvasSurface } from "./acrylicCanvas";
import {
  createTestDescriptor,
  createTestScene,
  FakeBitmap,
  recordingSurface,
} from "./compositorTestFixtures";
import { createMainThreadAcrylicExecutor } from "./mainThreadAcrylicExecutor";

describe("main-thread acrylic fallback executor", () => {
  it("uses the shared cache builder and returns one successful resource", async () => {
    const descriptor = createTestDescriptor(1);
    const bitmap = bitmapFor(descriptor);
    const surfaces: AcrylicCanvasSurface[] = [];
    const complete = vi.fn();
    const executor = createMainThreadAcrylicExecutor({
      canvases: {
        create(width, height) {
          const surface = recordingSurface(width, height);
          surfaces.push(surface);
          return surface;
        },
      },
      bitmaps: { create: async () => bitmap },
    });
    executor.start({ descriptor, scene: createTestScene() }, complete);
    await Promise.resolve();
    await Promise.resolve();
    expect(surfaces).toHaveLength(2);
    expect(complete).toHaveBeenCalledWith(expect.objectContaining({ kind: "success", descriptor }));
    expect(bitmap.closes).toBe(0);
  });

  it("reports a bounded render failure without retrying", async () => {
    const descriptor = createTestDescriptor(1);
    const complete = vi.fn();
    const executor = createMainThreadAcrylicExecutor({
      canvases: {
        create: () => {
          throw new Error("render failed");
        },
      },
      bitmaps: { create: () => bitmapFor(descriptor) },
    });
    executor.start({ descriptor, scene: createTestScene() }, complete);
    await Promise.resolve();
    expect(complete).toHaveBeenCalledOnce();
    expect(complete).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "failure", code: "render-failed", fatal: false }),
    );
  });

  it("closes a bitmap whose asynchronous creation finishes after disposal", async () => {
    const descriptor = createTestDescriptor(1);
    const bitmap = bitmapFor(descriptor);
    let release: (bitmap: FakeBitmap) => void = () => undefined;
    const pending = new Promise<FakeBitmap>((resolve) => {
      release = resolve;
    });
    const complete = vi.fn();
    const executor = createMainThreadAcrylicExecutor({
      canvases: { create: (width, height) => recordingSurface(width, height) },
      bitmaps: { create: () => pending },
    });
    executor.start({ descriptor, scene: createTestScene() }, complete);
    executor.dispose();
    release(bitmap);
    await Promise.resolve();
    await Promise.resolve();
    expect(complete).not.toHaveBeenCalled();
    expect(bitmap.closes).toBe(1);
  });
});

function bitmapFor(descriptor: ReturnType<typeof createTestDescriptor>): FakeBitmap {
  return new FakeBitmap(
    descriptor.anchor.cacheBackingSize.width,
    descriptor.anchor.cacheBackingSize.height,
  );
}
