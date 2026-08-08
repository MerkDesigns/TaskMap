// @vitest-environment node
import { describe, expect, it, vi, type Mock } from "vitest";
import { createViewport } from "../../../canvas/geometry/viewportMath";
import { calculateAdaptiveQuality } from "./adaptiveQuality";
import { createCacheResourceOwner } from "./cacheResourceOwner";
import {
  createCacheBuildDescriptor,
  type CacheBuildDescriptor,
  type DisposableCacheResource,
} from "./compositorTypes";

interface FakeResource extends DisposableCacheResource {
  readonly close: Mock<() => void>;
}

function resource(): FakeResource {
  return { close: vi.fn<() => void>() };
}

function descriptor(buildSerial: number, lifecycleEpoch = 1): CacheBuildDescriptor {
  const quality = calculateAdaptiveQuality({
    viewportWidthCssPx: 800,
    viewportHeightCssPx: 600,
  });
  return createCacheBuildDescriptor({
    lifecycleEpoch,
    buildSerial,
    sceneKey: "canvas-a",
    sceneRevision: buildSerial,
    sharedProfileRevision: 1,
    anchorViewport: createViewport({ x: 0, y: 0 }, 1, quality.viewportCssSize),
    marginCssPx: quality.marginCssPx,
    cacheScale: quality.cacheScale,
    cacheCssSize: quality.cacheCssSize,
    cacheBackingSize: quality.cacheBackingSize,
    outputBackingSize: quality.compositorBackingSize,
  });
}

describe("cache result resource ownership", () => {
  it("closes an explicitly rejected or stale result", () => {
    const owner = createCacheResourceOwner<FakeResource>();
    const rejected = resource();
    owner.reject(rejected);
    expect(rejected.close).toHaveBeenCalledOnce();

    const current = resource();
    const stale = resource();
    expect(owner.accept(descriptor(2), current)).toBe(true);
    expect(owner.accept(descriptor(1), stale)).toBe(false);
    expect(stale.close).toHaveBeenCalledOnce();
    expect(owner.getAccepted()?.resource).toBe(current);
  });

  it("closes a replaced accepted resource", () => {
    const owner = createCacheResourceOwner<FakeResource>();
    const first = resource();
    const second = resource();
    owner.accept(descriptor(1), first);
    owner.accept(descriptor(2), second);
    expect(first.close).toHaveBeenCalledOnce();
    expect(second.close).not.toHaveBeenCalled();
    expect(owner.getAccepted()?.resource).toBe(second);
  });

  it("closes each resource at most once across rejection and disposal", () => {
    const owner = createCacheResourceOwner<FakeResource>();
    const rejected = resource();
    owner.reject(rejected);
    owner.reject(rejected);
    expect(rejected.close).toHaveBeenCalledOnce();

    const accepted = resource();
    owner.accept(descriptor(1), accepted);
    owner.dispose();
    owner.dispose();
    owner.reject(accepted);
    expect(accepted.close).toHaveBeenCalledOnce();
    expect(owner.getAccepted()).toBeNull();
  });

  it("rejects resources after disposal", () => {
    const owner = createCacheResourceOwner<FakeResource>();
    owner.dispose();
    const late = resource();
    expect(owner.accept(descriptor(1), late)).toBe(false);
    expect(late.close).toHaveBeenCalledOnce();
  });

  it("prevents an obsolete lifecycle result from replacing a newer accepted result", () => {
    const owner = createCacheResourceOwner<FakeResource>();
    const current = resource();
    const obsolete = resource();
    owner.accept(descriptor(1, 2), current);
    expect(owner.accept(descriptor(99, 1), obsolete)).toBe(false);
    expect(obsolete.close).toHaveBeenCalledOnce();
    expect(current.close).not.toHaveBeenCalled();
    expect(owner.getAccepted()?.resource).toBe(current);
  });

  it("requires no resource close for queued descriptors that never produced output", () => {
    const owner = createCacheResourceOwner<FakeResource>();
    expect(owner.getAccepted()).toBeNull();
    owner.dispose();
    expect(owner.getAccepted()).toBeNull();
  });
});
