// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createViewport } from "../../../canvas/geometry/viewportMath";
import { calculateAdaptiveQuality } from "./adaptiveQuality";
import {
  completeCacheBuild,
  createCacheSchedulerState,
  disposeCacheScheduler,
  requestCacheBuild,
} from "./cacheScheduler";
import {
  cacheBuildDescriptorsEqual,
  compareCacheBuildRequestIdentity,
  createCacheBuildDescriptor,
  type CacheBuildDescriptor,
} from "./compositorTypes";

function descriptor(
  buildSerial: number,
  overrides: Partial<{
    lifecycleEpoch: number;
    sceneKey: string;
    sceneRevision: number;
    sharedProfileRevision: number;
  }> = {},
): CacheBuildDescriptor {
  const quality = calculateAdaptiveQuality({
    viewportWidthCssPx: 1000,
    viewportHeightCssPx: 600,
  });
  return createCacheBuildDescriptor({
    lifecycleEpoch: overrides.lifecycleEpoch ?? 1,
    buildSerial,
    sceneKey: overrides.sceneKey ?? "canvas-a",
    sceneRevision: overrides.sceneRevision ?? 4,
    sharedProfileRevision: overrides.sharedProfileRevision ?? 2,
    anchorViewport: createViewport({ x: 0, y: 0 }, 1, quality.viewportCssSize),
    marginCssPx: quality.marginCssPx,
    cacheScale: quality.cacheScale,
    cacheCssSize: quality.cacheCssSize,
    cacheBackingSize: quality.cacheBackingSize,
    outputBackingSize: quality.compositorBackingSize,
  });
}

describe("cache build descriptor", () => {
  it("creates deeply frozen bounded metadata without a scene payload", () => {
    const build = descriptor(3);
    expect(Object.isFrozen(build)).toBe(true);
    expect(Object.isFrozen(build.request)).toBe(true);
    expect(Object.isFrozen(build.scene)).toBe(true);
    expect(Object.isFrozen(build.anchor.viewport.pan)).toBe(true);
    expect(build).not.toHaveProperty("document");
    expect(build).not.toHaveProperty("scenePrimitives");
  });

  it("rejects invalid identity and output assumptions", () => {
    const valid = descriptor(3);
    expect(() =>
      createCacheBuildDescriptor({
        lifecycleEpoch: -1,
        buildSerial: 3,
        sceneKey: " ",
        sceneRevision: 0,
        sharedProfileRevision: 0,
        anchorViewport: valid.anchor.viewport,
        marginCssPx: valid.anchor.marginCssPx,
        cacheScale: valid.anchor.cacheScale,
        cacheCssSize: valid.anchor.cacheCssSize,
        cacheBackingSize: valid.anchor.cacheBackingSize,
        outputBackingSize: { width: 1.5, height: 2 },
      }),
    ).toThrow(RangeError);
  });

  it("separates request identity from full result-acceptance assumptions", () => {
    const requested = descriptor(3);
    expect(cacheBuildDescriptorsEqual(requested, descriptor(3))).toBe(true);
    expect(cacheBuildDescriptorsEqual(requested, descriptor(3, { sceneKey: "canvas-b" }))).toBe(
      false,
    );
    expect(cacheBuildDescriptorsEqual(requested, descriptor(3, { sceneRevision: 5 }))).toBe(false);
    expect(cacheBuildDescriptorsEqual(requested, descriptor(3, { sharedProfileRevision: 3 }))).toBe(
      false,
    );
  });

  it("orders request identity by lifecycle epoch and then build serial", () => {
    expect([
      compareCacheBuildRequestIdentity(
        { lifecycleEpoch: 1, buildSerial: 99 },
        { lifecycleEpoch: 2, buildSerial: 1 },
      ),
      compareCacheBuildRequestIdentity(
        { lifecycleEpoch: 2, buildSerial: 1 },
        { lifecycleEpoch: 2, buildSerial: 2 },
      ),
      compareCacheBuildRequestIdentity(
        { lifecycleEpoch: 2, buildSerial: 2 },
        { lifecycleEpoch: 2, buildSerial: 2 },
      ),
    ]).toEqual([-1, -1, 0]);
  });
});

describe("pure cache scheduler", () => {
  it("starts at most one build and keeps only one newest queued descriptor", () => {
    const first = descriptor(1);
    const second = descriptor(2);
    const third = descriptor(3);
    let transition = requestCacheBuild(createCacheSchedulerState(), first);
    expect(transition.buildToStart).toBe(first);
    expect(transition.state).toMatchObject({ active: first, queued: null, desired: first });

    transition = requestCacheBuild(transition.state, second);
    expect(transition.buildToStart).toBeNull();
    expect(transition.state).toMatchObject({ active: first, queued: second, desired: second });

    transition = requestCacheBuild(transition.state, third);
    expect(transition.buildToStart).toBeNull();
    expect(transition.state).toMatchObject({ active: first, queued: third, desired: third });
  });

  it("does not queue a duplicate active request", () => {
    const first = descriptor(1);
    const active = requestCacheBuild(createCacheSchedulerState(), first).state;
    const duplicate = requestCacheBuild(active, first);
    expect(duplicate).toEqual({ state: active, buildToStart: null });
    expect(duplicate.state).toMatchObject({ active: first, queued: null, desired: first });
  });

  it("does not change state for a duplicate queued request", () => {
    const first = descriptor(1);
    const third = descriptor(3);
    let state = requestCacheBuild(createCacheSchedulerState(), first).state;
    state = requestCacheBuild(state, third).state;
    expect(requestCacheBuild(state, third)).toEqual({ state, buildToStart: null });
  });

  it("does not let a stale lower build serial replace the newest desired request", () => {
    const first = descriptor(1);
    const third = descriptor(3);
    let state = requestCacheBuild(createCacheSchedulerState(), first).state;
    state = requestCacheBuild(state, third).state;
    const stale = requestCacheBuild(state, descriptor(2));
    expect(stale).toEqual({ state, buildToStart: null });
    expect(stale.state).toMatchObject({ active: first, queued: third, desired: third });
  });

  it("does not let an older lifecycle replace a newer lifecycle", () => {
    const active = descriptor(1, { lifecycleEpoch: 2 });
    const state = requestCacheBuild(createCacheSchedulerState(), active).state;
    const olderLifecycle = requestCacheBuild(state, descriptor(99, { lifecycleEpoch: 1 }));
    expect(olderLifecycle).toEqual({ state, buildToStart: null });
  });

  it("lets a newer lifecycle supersede an older lifecycle regardless of build serial", () => {
    const oldLifecycle = descriptor(99, { lifecycleEpoch: 1 });
    const newLifecycle = descriptor(1, { lifecycleEpoch: 2 });
    const active = requestCacheBuild(createCacheSchedulerState(), oldLifecycle).state;
    const superseded = requestCacheBuild(active, newLifecycle);
    expect(superseded.buildToStart).toBeNull();
    expect(superseded.state).toMatchObject({
      active: oldLifecycle,
      queued: newLifecycle,
      desired: newLifecycle,
    });
  });

  it("fails closed when one request identity has conflicting descriptor assumptions", () => {
    const first = descriptor(1);
    const active = requestCacheBuild(createCacheSchedulerState(), first).state;
    expect(() => requestCacheBuild(active, descriptor(1, { sceneRevision: 5 }))).toThrow(
      "Cache build request identity must uniquely identify one descriptor",
    );
    expect(active).toMatchObject({ active: first, queued: null, desired: first });
  });

  it("rejects stale active output and starts the newest queued build", () => {
    const first = descriptor(1);
    const newest = descriptor(3);
    let state = requestCacheBuild(createCacheSchedulerState(), first).state;
    state = requestCacheBuild(state, descriptor(2)).state;
    state = requestCacheBuild(state, newest).state;

    const completion = completeCacheBuild(state, first);
    expect(completion.decision).toBe("reject");
    expect(completion.buildToStart).toBe(newest);
    expect(completion.state).toMatchObject({ active: newest, queued: null, desired: newest });
  });

  it("accepts only the relevant desired completion", () => {
    const desired = descriptor(7);
    const scheduled = requestCacheBuild(createCacheSchedulerState(), desired);
    const completion = completeCacheBuild(scheduled.state, desired);
    expect(completion).toMatchObject({
      decision: "accept",
      buildToStart: null,
      state: { active: null, queued: null, desired },
    });
  });

  it("rejects late completions without disturbing the current active build", () => {
    const old = descriptor(1);
    const current = descriptor(2);
    let state = requestCacheBuild(createCacheSchedulerState(), old).state;
    state = requestCacheBuild(state, current).state;
    state = completeCacheBuild(state, old).state;
    const late = completeCacheBuild(state, old);
    expect(late.decision).toBe("reject");
    expect(late.state.active).toBe(current);
    expect(late.buildToStart).toBeNull();
  });

  it.each([
    ["lifecycle epoch", { lifecycleEpoch: 2 }],
    ["scene identity", { sceneKey: "canvas-b" }],
    ["scene revision", { sceneRevision: 5 }],
    ["shared profile revision", { sharedProfileRevision: 3 }],
  ] as const)("rejects completion superseded by a newer %s", (_, overrides) => {
    const old = descriptor(1);
    const newer = descriptor(2, overrides);
    let state = requestCacheBuild(createCacheSchedulerState(), old).state;
    state = requestCacheBuild(state, newer).state;
    const completion = completeCacheBuild(state, old);
    expect(completion.decision).toBe("reject");
    expect(completion.buildToStart).toBe(newer);
  });

  it("disposal prevents future acceptance and work", () => {
    const build = descriptor(1);
    const active = requestCacheBuild(createCacheSchedulerState(), build).state;
    const disposed = disposeCacheScheduler(active);
    expect(disposed).toEqual({ disposed: true, active: null, queued: null, desired: null });
    expect(requestCacheBuild(disposed, descriptor(2))).toEqual({
      state: disposed,
      buildToStart: null,
    });
    expect(completeCacheBuild(disposed, build)).toEqual({
      state: disposed,
      decision: "reject",
      buildToStart: null,
    });
  });
});
