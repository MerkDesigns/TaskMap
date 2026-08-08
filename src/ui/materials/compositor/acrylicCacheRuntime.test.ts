// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createAcrylicBitmapResource } from "./acrylicBitmapResource";
import { createAcrylicCacheRuntime } from "./acrylicCacheRuntime";
import {
  ControlledAcrylicExecutor,
  createTestDescriptor,
  createTestScene,
  FakeBitmap,
} from "./compositorTestFixtures";

describe("acrylic cache runtime scheduling and ownership", () => {
  it("runs one active build and then only the newest queued request", () => {
    const worker = new ControlledAcrylicExecutor("worker-offscreen");
    const runtime = createAcrylicCacheRuntime({ workerExecutor: worker });
    runtime.request(createTestDescriptor(1), createTestScene());
    runtime.request(createTestDescriptor(2), createTestScene());
    runtime.request(createTestDescriptor(3), createTestScene());
    expect(worker.starts.map((item) => item.payload.descriptor.request.buildSerial)).toEqual([1]);
    const stale = worker.succeed(0);
    expect(stale.closes).toBe(1);
    expect(worker.starts.map((item) => item.payload.descriptor.request.buildSerial)).toEqual([
      1, 3,
    ]);
  });

  it("accepts the relevant success and replaces and closes the prior accepted bitmap", () => {
    const worker = new ControlledAcrylicExecutor("worker-offscreen");
    const runtime = createAcrylicCacheRuntime({ workerExecutor: worker });
    runtime.request(createTestDescriptor(1), createTestScene());
    const first = worker.succeed(0);
    expect(runtime.getSnapshot().accepted?.resource.bitmap).toBe(first);
    runtime.request(createTestDescriptor(2), createTestScene());
    const second = worker.succeed(1);
    expect(first.closes).toBe(1);
    expect(second.closes).toBe(0);
    expect(runtime.getSnapshot().accepted?.resource.bitmap).toBe(second);
  });

  it("prevents a superseded success from overwriting a newer accepted result", () => {
    const worker = new ControlledAcrylicExecutor("worker-offscreen");
    const runtime = createAcrylicCacheRuntime({ workerExecutor: worker });
    runtime.request(createTestDescriptor(1), createTestScene());
    runtime.request(createTestDescriptor(2), createTestScene());
    worker.succeed(0);
    const current = worker.succeed(1);
    const obsolete = bitmapFor(1);
    worker.starts[0].complete({
      kind: "success",
      descriptor: worker.starts[0].payload.descriptor,
      resource: createAcrylicBitmapResource(obsolete),
    });
    expect(obsolete.closes).toBe(1);
    expect(runtime.getSnapshot().accepted?.resource.bitmap).toBe(current);
  });

  it("ignores a stale failure without downgrading the current Worker build", () => {
    const worker = new ControlledAcrylicExecutor("worker-offscreen");
    const fallback = new ControlledAcrylicExecutor("main-thread-fallback");
    const runtime = createAcrylicCacheRuntime({
      workerExecutor: worker,
      mainThreadExecutor: fallback,
    });
    runtime.request(createTestDescriptor(1), createTestScene());
    runtime.request(createTestDescriptor(2), createTestScene());
    worker.succeed(0);
    worker.starts[0].complete({
      kind: "failure",
      descriptor: worker.starts[0].payload.descriptor,
      code: "worker-error",
      fatal: true,
    });
    expect(runtime.getSnapshot().executionMode).toBe("worker-offscreen");
    expect(worker.disposeCount).toBe(0);
    expect(fallback.starts).toHaveLength(0);
  });

  it("downgrades one fatal Worker failure and starts the queued build on fallback", () => {
    const worker = new ControlledAcrylicExecutor("worker-offscreen");
    const fallback = new ControlledAcrylicExecutor("main-thread-fallback");
    const runtime = createAcrylicCacheRuntime({
      workerExecutor: worker,
      mainThreadExecutor: fallback,
    });
    runtime.request(createTestDescriptor(1), createTestScene());
    runtime.request(createTestDescriptor(2), createTestScene());
    worker.fail(0);
    expect(runtime.getSnapshot().executionMode).toBe("main-thread-fallback");
    expect(worker.disposeCount).toBe(1);
    expect(fallback.starts).toHaveLength(1);
    expect(fallback.starts[0].payload.descriptor.request.buildSerial).toBe(2);
  });

  it("continues the current desired Worker build on fallback and accepts its success", () => {
    const worker = new ControlledAcrylicExecutor("worker-offscreen");
    const fallback = new ControlledAcrylicExecutor("main-thread-fallback");
    const runtime = createAcrylicCacheRuntime({
      workerExecutor: worker,
      mainThreadExecutor: fallback,
    });
    runtime.request(createTestDescriptor(1), createTestScene());
    expect(fallback.starts).toHaveLength(0);
    worker.fail(0);
    expect(worker.starts).toHaveLength(1);
    expect(worker.disposeCount).toBe(1);
    expect(fallback.starts).toHaveLength(1);
    expect(fallback.starts[0].payload.descriptor.request.buildSerial).toBe(1);
    const accepted = fallback.succeed(0);
    expect(runtime.getSnapshot().accepted?.resource.bitmap).toBe(accepted);
    expect(runtime.getSnapshot().lastFailure).toBeNull();
  });

  it("defers the current desired Worker build on fallback while interaction is active", () => {
    const worker = new ControlledAcrylicExecutor("worker-offscreen");
    const fallback = new ControlledAcrylicExecutor("main-thread-fallback");
    const runtime = createAcrylicCacheRuntime({
      workerExecutor: worker,
      mainThreadExecutor: fallback,
      interactionActive: true,
    });
    runtime.request(createTestDescriptor(1), createTestScene());
    worker.fail(0);
    expect(runtime.getSnapshot()).toMatchObject({
      executionMode: "main-thread-fallback",
      deferred: true,
    });
    expect(fallback.starts).toHaveLength(0);
    runtime.setInteractionActive(false);
    expect(fallback.starts).toHaveLength(1);
    expect(fallback.starts[0].payload.descriptor.request.buildSerial).toBe(1);
  });

  it("completes a fatal Worker failure as overlay-only when no fallback exists", () => {
    const worker = new ControlledAcrylicExecutor("worker-offscreen");
    const runtime = createAcrylicCacheRuntime({ workerExecutor: worker });
    runtime.request(createTestDescriptor(1), createTestScene());
    worker.fail(0);
    expect(worker.disposeCount).toBe(1);
    expect(runtime.getSnapshot()).toMatchObject({
      executionMode: "overlay-only",
      presentationMode: "overlay-only",
      deferred: false,
    });
    expect(runtime.getSnapshot().scheduler.active).toBeNull();
  });

  it("never recreates a failed Worker for later requests", () => {
    const worker = new ControlledAcrylicExecutor("worker-offscreen");
    const fallback = new ControlledAcrylicExecutor("main-thread-fallback");
    const runtime = createAcrylicCacheRuntime({
      workerExecutor: worker,
      mainThreadExecutor: fallback,
    });
    runtime.request(createTestDescriptor(1), createTestScene());
    worker.fail(0);
    runtime.request(createTestDescriptor(2), createTestScene());
    expect(worker.starts).toHaveLength(1);
    expect(worker.disposeCount).toBe(1);
    expect(fallback.starts).toHaveLength(1);
  });

  it("closes the accepted bitmap on disposal", () => {
    const worker = new ControlledAcrylicExecutor("worker-offscreen");
    const runtime = createAcrylicCacheRuntime({ workerExecutor: worker });
    runtime.request(createTestDescriptor(1), createTestScene());
    const bitmap = worker.succeed(0);
    runtime.dispose();
    runtime.dispose();
    expect(bitmap.closes).toBe(1);
    expect(runtime.getSnapshot().presentationMode).toBe("overlay-only");
  });

  it("closes a result delivered after runtime disposal", () => {
    const worker = new ControlledAcrylicExecutor("worker-offscreen");
    const runtime = createAcrylicCacheRuntime({ workerExecutor: worker });
    runtime.request(createTestDescriptor(1), createTestScene());
    runtime.dispose();
    const bitmap = worker.succeed(0);
    expect(bitmap.closes).toBe(1);
    expect(runtime.getSnapshot().accepted).toBeNull();
  });

  it("fails closed on invalid scene data without mutating scheduling state", () => {
    const worker = new ControlledAcrylicExecutor("worker-offscreen");
    const runtime = createAcrylicCacheRuntime({ workerExecutor: worker });
    expect(() => runtime.request(createTestDescriptor(1), { primitives: [] })).toThrow();
    expect(runtime.getSnapshot().scheduler.active).toBeNull();
    expect(worker.starts).toHaveLength(0);
  });

  it("performs no JSON serialization, parsing, or structured cloning on the request path", () => {
    const stringify = vi.spyOn(JSON, "stringify");
    const parse = vi.spyOn(JSON, "parse");
    const clone = vi.spyOn(globalThis, "structuredClone");
    const worker = new ControlledAcrylicExecutor("worker-offscreen");
    const runtime = createAcrylicCacheRuntime({ workerExecutor: worker });
    runtime.request(createTestDescriptor(1), createTestScene());
    runtime.request(createTestDescriptor(2), createTestScene());
    expect(stringify).not.toHaveBeenCalled();
    expect(parse).not.toHaveBeenCalled();
    expect(clone).not.toHaveBeenCalled();
    stringify.mockRestore();
    parse.mockRestore();
    clone.mockRestore();
  });
});

describe("main-thread interaction deferral and overlay degradation", () => {
  it("defers 120 active-interaction requests and starts only the newest when settled", () => {
    const fallback = new ControlledAcrylicExecutor("main-thread-fallback");
    const runtime = createAcrylicCacheRuntime({
      mainThreadExecutor: fallback,
      interactionActive: true,
    });
    for (let serial = 1; serial <= 120; serial += 1) {
      runtime.request(createTestDescriptor(serial), createTestScene());
    }
    expect(fallback.starts).toHaveLength(0);
    expect(runtime.getSnapshot().deferred).toBe(true);
    runtime.setInteractionActive(false);
    expect(fallback.starts).toHaveLength(1);
    expect(fallback.starts[0].payload.descriptor.request.buildSerial).toBe(120);
    expect(runtime.getSnapshot().lastFailure).toBeNull();
  });

  it("represents overlay-only while an initial fallback build is unsafe to run", () => {
    const fallback = new ControlledAcrylicExecutor("main-thread-fallback");
    const runtime = createAcrylicCacheRuntime({
      mainThreadExecutor: fallback,
      interactionActive: true,
    });
    runtime.request(createTestDescriptor(1), createTestScene());
    expect(runtime.getSnapshot()).toMatchObject({
      executionMode: "main-thread-fallback",
      presentationMode: "overlay-only",
      deferred: true,
    });
  });

  it("keeps an existing accepted cache while a newer fallback build is deferred", () => {
    const fallback = new ControlledAcrylicExecutor("main-thread-fallback");
    const runtime = createAcrylicCacheRuntime({ mainThreadExecutor: fallback });
    runtime.request(createTestDescriptor(1), createTestScene());
    const accepted = fallback.succeed(0);
    runtime.setInteractionActive(true);
    runtime.request(createTestDescriptor(2), createTestScene());
    expect(fallback.starts).toHaveLength(1);
    expect(runtime.getSnapshot().presentationMode).toBe("acrylic-cache");
    expect(runtime.getSnapshot().accepted?.resource.bitmap).toBe(accepted);
  });

  it("allows a later settled transition to start the newest deferred request", () => {
    const fallback = new ControlledAcrylicExecutor("main-thread-fallback");
    const runtime = createAcrylicCacheRuntime({ mainThreadExecutor: fallback });
    runtime.setInteractionActive(true);
    runtime.request(createTestDescriptor(4), createTestScene());
    runtime.request(createTestDescriptor(5), createTestScene());
    runtime.setInteractionActive(false);
    expect(fallback.starts[0].payload.descriptor.request.buildSerial).toBe(5);
  });

  it("does not retry a failed fallback build in a loop", () => {
    const fallback = new ControlledAcrylicExecutor("main-thread-fallback");
    const runtime = createAcrylicCacheRuntime({ mainThreadExecutor: fallback });
    runtime.request(createTestDescriptor(1), createTestScene());
    fallback.fail(0, false);
    expect(fallback.starts).toHaveLength(1);
    expect(runtime.getSnapshot().presentationMode).toBe("overlay-only");
  });

  it("stays explicitly overlay-only when neither builder is available", () => {
    const runtime = createAcrylicCacheRuntime<FakeBitmap>({});
    runtime.request(createTestDescriptor(1), createTestScene());
    expect(runtime.getSnapshot()).toMatchObject({
      executionMode: "overlay-only",
      presentationMode: "overlay-only",
      deferred: false,
    });
  });
});

function bitmapFor(serial: number): FakeBitmap {
  const descriptor = createTestDescriptor(serial);
  return new FakeBitmap(
    descriptor.anchor.cacheBackingSize.width,
    descriptor.anchor.cacheBackingSize.height,
  );
}
