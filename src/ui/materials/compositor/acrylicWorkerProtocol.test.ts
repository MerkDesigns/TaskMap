// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createTestDescriptor, createTestScene, FakeBitmap } from "./compositorTestFixtures";
import {
  createAcrylicWorkerBuildRequest,
  isTransferableCacheBitmap,
  parseAcrylicWorkerBuildRequest,
  parseAcrylicWorkerResponse,
  readWorkerRequestIdentity,
} from "./acrylicWorkerProtocol";

describe("acrylic module-worker protocol", () => {
  it("keeps descriptor, scene snapshot, and fixed profile as separate plain payloads", () => {
    const descriptor = createTestDescriptor(7);
    const scene = createTestScene();
    const request = createAcrylicWorkerBuildRequest(descriptor, scene);
    expect(request.descriptor).toBe(descriptor);
    expect(request.scene).toBe(scene);
    expect(request.profile).toEqual({
      id: "shared-acrylic",
      revision: 1,
      blurRadiusCssPx: 45,
      saturation: 1,
      brightness: 1,
    });
    expect(request).not.toHaveProperty("document");
    expect(request).not.toHaveProperty("elements");
  });

  it("round-trips a structured-cloned valid request with exact identity", () => {
    const request = createAcrylicWorkerBuildRequest(createTestDescriptor(7), createTestScene());
    const parsed = parseAcrylicWorkerBuildRequest(structuredClone(request));
    expect(parsed.descriptor).toEqual(request.descriptor);
    expect(parsed.scene).toEqual(request.scene);
    expect(readWorkerRequestIdentity(request)).toEqual({ lifecycleEpoch: 1, buildSerial: 7 });
  });

  it("preserves the complete success descriptor and transferable bitmap", () => {
    const descriptor = createTestDescriptor(7);
    const bitmap = new FakeBitmap(
      descriptor.anchor.cacheBackingSize.width,
      descriptor.anchor.cacheBackingSize.height,
    );
    const response = parseAcrylicWorkerResponse(
      { type: "success", descriptor, bitmap },
      isTransferableCacheBitmap,
    );
    expect(response.type).toBe("success");
    if (response.type === "success") {
      expect(response.descriptor).toEqual(descriptor);
      expect(response.bitmap).toBe(bitmap);
    }
  });

  it("preserves typed failure request identity", () => {
    const response = parseAcrylicWorkerResponse(
      {
        type: "failure",
        request: { lifecycleEpoch: 4, buildSerial: 91 },
        code: "render-failed",
      },
      isTransferableCacheBitmap,
    );
    expect(response).toEqual({
      type: "failure",
      request: { lifecycleEpoch: 4, buildSerial: 91 },
      code: "render-failed",
    });
  });

  it("rejects a scene whose identity differs from its descriptor", () => {
    const request = createAcrylicWorkerBuildRequest(createTestDescriptor(7), createTestScene());
    expect(() =>
      parseAcrylicWorkerBuildRequest({
        ...request,
        scene: { ...request.scene, identity: { key: "other", revision: 1 } },
      }),
    ).toThrow("identity");
  });

  it("rejects any alternate expensive profile", () => {
    const request = createAcrylicWorkerBuildRequest(createTestDescriptor(7), createTestScene());
    expect(() =>
      parseAcrylicWorkerBuildRequest({
        ...request,
        profile: { ...request.profile, blurRadiusCssPx: 32 },
      }),
    ).toThrow("one shared acrylic profile");
  });

  it("rejects malformed success resources and failure codes", () => {
    const descriptor = createTestDescriptor(7);
    expect(() =>
      parseAcrylicWorkerResponse(
        { type: "success", descriptor, bitmap: { width: 1, height: 1 } },
        isTransferableCacheBitmap,
      ),
    ).toThrow("bitmap");
    expect(() =>
      parseAcrylicWorkerResponse(
        { type: "failure", request: descriptor.request, code: "retry-forever" },
        isTransferableCacheBitmap,
      ),
    ).toThrow("code");
  });
});
