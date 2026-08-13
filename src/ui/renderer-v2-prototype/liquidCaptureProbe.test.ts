// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { installLiquidCaptureProbe } from "./liquidCaptureProbe";

afterEach(() => {
  Reflect.deleteProperty(globalThis, "GPUQueue");
});

describe("benchmark Liquid capture probe", () => {
  it("wraps and restores the queue method while recording dimensions", () => {
    const copy = vi.fn();
    class FakeQueue {}
    Object.defineProperty(FakeQueue.prototype, "copyElementImageToTexture", {
      value: copy,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, "GPUQueue", { value: FakeQueue, configurable: true });
    const report = vi.fn();
    const probe = installLiquidCaptureProbe(report);
    const queue = new FakeQueue() as FakeQueue & {
      copyElementImageToTexture: (...arguments_: unknown[]) => void;
    };

    queue.copyElementImageToTexture({ source: {} }, { width: 320, height: 180 });
    expect(probe.available).toBe(true);
    expect(report).toHaveBeenCalledWith(320, 180);
    expect(copy).toHaveBeenCalledOnce();

    probe.dispose();
    expect(queue.copyElementImageToTexture).toBe(copy);
  });
});
