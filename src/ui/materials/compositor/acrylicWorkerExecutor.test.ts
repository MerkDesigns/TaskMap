// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createAcrylicBitmapResource } from "./acrylicBitmapResource";
import { createAcrylicCacheRuntime } from "./acrylicCacheRuntime";
import { createTestDescriptor, createTestScene, FakeBitmap } from "./compositorTestFixtures";
import type { AcrylicWorkerPort } from "./acrylicWorkerExecutor";
import { createAcrylicWorkerExecutor } from "./acrylicWorkerExecutor";

class FakeWorkerPort implements AcrylicWorkerPort {
  readonly posted: object[] = [];
  terminateCount = 0;
  throwOnPost = false;
  private onMessage: (data: unknown) => void = () => undefined;
  private onError: () => void = () => undefined;
  postMessage(message: object): void {
    if (this.throwOnPost) throw new Error("post failed");
    this.posted.push(message);
  }
  listen(onMessage: (data: unknown) => void, onError: () => void): void {
    this.onMessage = onMessage;
    this.onError = onError;
  }
  terminate(): void {
    this.terminateCount += 1;
  }
  message(data: unknown): void {
    this.onMessage(data);
  }
  error(): void {
    this.onError();
  }
}

describe("acrylic worker executor", () => {
  it("posts one bounded request and refuses a second active build", () => {
    const port = new FakeWorkerPort();
    const executor = createAcrylicWorkerExecutor(port);
    executor.start(
      { descriptor: createTestDescriptor(1), scene: createTestScene() },
      () => undefined,
    );
    expect(port.posted).toHaveLength(1);
    expect(port.posted[0]).not.toHaveProperty("document");
    expect(() =>
      executor.start(
        { descriptor: createTestDescriptor(2), scene: createTestScene() },
        () => undefined,
      ),
    ).toThrow("active build");
  });

  it("delivers an exact successful transferable bitmap without closing it", () => {
    const port = new FakeWorkerPort();
    const executor = createAcrylicWorkerExecutor(port);
    const descriptor = createTestDescriptor(1);
    const bitmap = bitmapFor(descriptor);
    const complete = vi.fn();
    executor.start({ descriptor, scene: createTestScene() }, complete);
    port.message({ type: "success", descriptor, bitmap });
    expect(complete).toHaveBeenCalledOnce();
    expect(complete.mock.calls[0][0]).toMatchObject({ kind: "success", descriptor });
    expect(bitmap.closes).toBe(0);
  });

  it("closes a mismatched success and fails the active request closed", () => {
    const port = new FakeWorkerPort();
    const executor = createAcrylicWorkerExecutor(port);
    const descriptor = createTestDescriptor(3);
    const bitmap = bitmapFor(descriptor);
    const complete = vi.fn();
    executor.start({ descriptor, scene: createTestScene() }, complete);
    port.message({
      type: "success",
      descriptor: createTestDescriptor(3, { sceneRevision: 2 }),
      bitmap,
    });
    expect(bitmap.closes).toBe(1);
    expect(complete).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "failure", code: "malformed-result", fatal: true }),
    );
    expect(port.terminateCount).toBe(1);
  });

  it("closes an otherwise valid success when no request owns it", () => {
    const port = new FakeWorkerPort();
    createAcrylicWorkerExecutor(port);
    const descriptor = createTestDescriptor(1);
    const bitmap = bitmapFor(descriptor);
    port.message({ type: "success", descriptor, bitmap });
    expect(bitmap.closes).toBe(1);
  });

  it("closes a stale success without disturbing the newer active build", () => {
    const port = new FakeWorkerPort();
    const executor = createAcrylicWorkerExecutor(port);
    const complete = vi.fn();
    executor.start({ descriptor: createTestDescriptor(3), scene: createTestScene() }, complete);
    const staleDescriptor = createTestDescriptor(2);
    const bitmap = bitmapFor(staleDescriptor);
    port.message({ type: "success", descriptor: staleDescriptor, bitmap });
    expect(bitmap.closes).toBe(1);
    expect(complete).not.toHaveBeenCalled();
    expect(port.terminateCount).toBe(0);
  });

  it("closes a repeated stale bitmap at most once", () => {
    const port = new FakeWorkerPort();
    const executor = createAcrylicWorkerExecutor(port);
    executor.start(
      { descriptor: createTestDescriptor(3), scene: createTestScene() },
      () => undefined,
    );
    const staleDescriptor = createTestDescriptor(2);
    const bitmap = bitmapFor(staleDescriptor);
    port.message({ type: "success", descriptor: staleDescriptor, bitmap });
    port.message({ type: "success", descriptor: staleDescriptor, bitmap });
    expect(bitmap.closes).toBe(1);
  });

  it("ignores a stale failure identity without disturbing the current build", () => {
    const port = new FakeWorkerPort();
    const executor = createAcrylicWorkerExecutor(port);
    const complete = vi.fn();
    executor.start({ descriptor: createTestDescriptor(3), scene: createTestScene() }, complete);
    port.message({
      type: "failure",
      request: { lifecycleEpoch: 1, buildSerial: 2 },
      code: "render-failed",
    });
    expect(complete).not.toHaveBeenCalled();
    expect(port.terminateCount).toBe(0);
  });

  it("processes a matching typed failure for the active request", () => {
    const port = new FakeWorkerPort();
    const executor = createAcrylicWorkerExecutor(port);
    const complete = vi.fn();
    executor.start({ descriptor: createTestDescriptor(5), scene: createTestScene() }, complete);
    port.message({
      type: "failure",
      request: { lifecycleEpoch: 1, buildSerial: 5 },
      code: "render-failed",
    });
    expect(complete).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "failure", code: "render-failed", fatal: true }),
    );
    expect(port.terminateCount).toBe(1);
  });

  it("fails the pending request closed for a newer impossible failure identity", () => {
    const port = new FakeWorkerPort();
    const executor = createAcrylicWorkerExecutor(port);
    const complete = vi.fn();
    executor.start({ descriptor: createTestDescriptor(5), scene: createTestScene() }, complete);
    port.message({
      type: "failure",
      request: { lifecycleEpoch: 1, buildSerial: 6 },
      code: "render-failed",
    });
    expect(complete).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "failure", code: "malformed-result", fatal: true }),
    );
    expect(port.terminateCount).toBe(1);
  });

  it.each([
    ["width", 1, 0],
    ["height", 0, 1],
  ])(
    "closes a wrong-%s bitmap once and fails the request closed",
    (_axis, widthDelta, heightDelta) => {
      const port = new FakeWorkerPort();
      const executor = createAcrylicWorkerExecutor(port);
      const descriptor = createTestDescriptor(1);
      const size = descriptor.anchor.cacheBackingSize;
      const bitmap = new FakeBitmap(size.width + widthDelta, size.height + heightDelta);
      const complete = vi.fn();
      executor.start({ descriptor, scene: createTestScene() }, complete);
      port.message({ type: "success", descriptor, bitmap });
      port.message({ type: "success", descriptor, bitmap });
      expect(bitmap.closes).toBe(1);
      expect(complete).toHaveBeenCalledTimes(1);
      expect(complete).toHaveBeenCalledWith(
        expect.objectContaining({ kind: "failure", code: "malformed-result", fatal: true }),
      );
    },
  );

  it("never admits a wrong-size bitmap to the runtime resource owner", () => {
    const port = new FakeWorkerPort();
    const executor = createAcrylicWorkerExecutor(port);
    const runtime = createAcrylicCacheRuntime({ workerExecutor: executor });
    const descriptor = createTestDescriptor(1);
    const bitmap = new FakeBitmap(
      descriptor.anchor.cacheBackingSize.width + 1,
      descriptor.anchor.cacheBackingSize.height,
    );
    runtime.request(descriptor, createTestScene());
    port.message({ type: "success", descriptor, bitmap });
    expect(bitmap.closes).toBe(1);
    expect(runtime.getSnapshot()).toMatchObject({
      executionMode: "overlay-only",
      presentationMode: "overlay-only",
      accepted: null,
    });
  });

  it("turns a Worker error into one fatal completion and one termination", () => {
    const port = new FakeWorkerPort();
    const executor = createAcrylicWorkerExecutor(port);
    const complete = vi.fn();
    executor.start({ descriptor: createTestDescriptor(1), scene: createTestScene() }, complete);
    port.error();
    port.error();
    expect(complete).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "failure", code: "worker-error", fatal: true }),
    );
    expect(port.terminateCount).toBe(1);
  });

  it("fails a synchronous post error without recreating the Worker", () => {
    const port = new FakeWorkerPort();
    port.throwOnPost = true;
    const executor = createAcrylicWorkerExecutor(port);
    const complete = vi.fn();
    executor.start({ descriptor: createTestDescriptor(1), scene: createTestScene() }, complete);
    expect(complete).toHaveBeenCalledWith(
      expect.objectContaining({ code: "worker-post-failed", fatal: true }),
    );
    expect(port.terminateCount).toBe(1);
  });

  it("terminates on disposal and closes a transferred result arriving afterward", () => {
    const port = new FakeWorkerPort();
    const executor = createAcrylicWorkerExecutor(port);
    const descriptor = createTestDescriptor(1);
    const bitmap = bitmapFor(descriptor);
    executor.start({ descriptor, scene: createTestScene() }, () => undefined);
    executor.dispose();
    port.message({ type: "success", descriptor, bitmap });
    executor.dispose();
    expect(port.terminateCount).toBe(1);
    expect(bitmap.closes).toBe(1);
  });

  it("wraps bitmap close as an at-most-once operation", () => {
    const bitmap = new FakeBitmap(2, 3);
    const resource = createAcrylicBitmapResource(bitmap);
    resource.close();
    resource.close();
    expect(resource.closed).toBe(true);
    expect(bitmap.closes).toBe(1);
  });
});

function bitmapFor(descriptor: ReturnType<typeof createTestDescriptor>): FakeBitmap {
  return new FakeBitmap(
    descriptor.anchor.cacheBackingSize.width,
    descriptor.anchor.cacheBackingSize.height,
  );
}
