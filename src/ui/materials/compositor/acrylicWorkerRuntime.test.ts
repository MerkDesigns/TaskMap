// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createTestDescriptor, createTestScene, FakeBitmap } from "./compositorTestFixtures";
import { createAcrylicWorkerBuildRequest } from "./acrylicWorkerProtocol";
import {
  processAcrylicWorkerMessage,
  type AcrylicWorkerMessageTarget,
} from "./acrylicWorkerRuntime";
import { SharedAcrylicCacheBuildError } from "./sharedAcrylicCacheBuilder";

class RecordingTarget implements AcrylicWorkerMessageTarget {
  readonly messages: { readonly message: object; readonly transfer: readonly object[] }[] = [];
  failSuccessPost = false;
  postMessage(message: object, transfer: readonly object[] = []): void {
    if (this.failSuccessPost && (message as { type?: unknown }).type === "success") {
      throw new Error("transfer failed");
    }
    this.messages.push({ message, transfer });
  }
}

describe("worker-side acrylic request execution", () => {
  it("posts a success with the bitmap as the sole transferable and relinquishes ownership", async () => {
    const descriptor = createTestDescriptor(9);
    const request = createAcrylicWorkerBuildRequest(descriptor, createTestScene());
    const bitmap = bitmapFor(descriptor);
    const target = new RecordingTarget();
    await processAcrylicWorkerMessage(request, target, () => bitmap);
    expect(target.messages).toHaveLength(1);
    expect(target.messages[0].message).toMatchObject({ type: "success", descriptor, bitmap });
    expect(target.messages[0].transfer).toEqual([bitmap]);
    expect(bitmap.closes).toBe(0);
  });

  it("closes the bitmap if transfer posting fails", async () => {
    const descriptor = createTestDescriptor(9);
    const bitmap = bitmapFor(descriptor);
    const target = new RecordingTarget();
    target.failSuccessPost = true;
    await processAcrylicWorkerMessage(
      createAcrylicWorkerBuildRequest(descriptor, createTestScene()),
      target,
      () => bitmap,
    );
    expect(bitmap.closes).toBe(1);
    expect(target.messages[0].message).toMatchObject({
      type: "failure",
      request: descriptor.request,
      code: "bitmap-failed",
    });
  });

  it("returns a typed renderer failure with exact request identity", async () => {
    const descriptor = createTestDescriptor(9);
    const target = new RecordingTarget();
    await processAcrylicWorkerMessage(
      createAcrylicWorkerBuildRequest(descriptor, createTestScene()),
      target,
      () => {
        throw new SharedAcrylicCacheBuildError("render-failed", "failed");
      },
    );
    expect(target.messages[0].message).toEqual({
      type: "failure",
      request: descriptor.request,
      code: "render-failed",
    });
  });

  it("reports an invalid bounded payload when its request identity can be recovered", async () => {
    const descriptor = createTestDescriptor(9);
    const target = new RecordingTarget();
    await processAcrylicWorkerMessage(
      { ...createAcrylicWorkerBuildRequest(descriptor, createTestScene()), scene: null },
      target,
      () => bitmapFor(descriptor),
    );
    expect(target.messages[0].message).toEqual({
      type: "failure",
      request: descriptor.request,
      code: "invalid-request",
    });
  });

  it("does not invent an identity or resource for wholly malformed input", async () => {
    const target = new RecordingTarget();
    await processAcrylicWorkerMessage({ type: "build" }, target, () => new FakeBitmap(1, 1));
    expect(target.messages).toHaveLength(0);
  });
});

function bitmapFor(descriptor: ReturnType<typeof createTestDescriptor>): FakeBitmap {
  return new FakeBitmap(
    descriptor.anchor.cacheBackingSize.width,
    descriptor.anchor.cacheBackingSize.height,
  );
}
