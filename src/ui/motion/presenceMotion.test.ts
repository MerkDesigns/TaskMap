import { afterEach, describe, expect, it } from "vitest";
import { readMaterialPresentation } from "../materials/materialGeometryInvalidation";
import { cubicBezier } from "./motionMath";
import type { MotionFrameScheduler, MotionFrameSubscriber } from "./motionFrameScheduler";
import { createPresenceMotion, type PresenceTiming } from "./presenceMotion";

afterEach(() => document.body.replaceChildren());

function manualScheduler() {
  const subscribers = new Set<MotionFrameSubscriber>();
  const scheduler: MotionFrameScheduler = {
    subscribe(subscriber) {
      subscribers.add(subscriber);
      return () => subscribers.delete(subscriber);
    },
    getSnapshot: () => ({ subscriberCount: subscribers.size, framePending: false }),
    dispose: () => subscribers.clear(),
  };
  const advance = (deltaMs: number) => {
    for (const subscriber of [...subscribers]) {
      if (!subscriber({ timestampMs: 0, deltaMs })) subscribers.delete(subscriber);
    }
  };
  return { scheduler, advance, active: () => subscribers.size };
}

const linear = (durationMs: number): PresenceTiming => ({ durationMs, easing: (t) => t });

describe("presence motion channels", () => {
  it("composes slide, lift and scale into one transform and projects it for shared planes", () => {
    const surface = document.createElement("div");
    const { scheduler } = manualScheduler();
    const motion = createPresenceMotion(surface, {
      scheduler,
      reducedMotion: false,
      channels: { materialFade: true, slide: { x: 20 }, lift: 10, scale: 0.9 },
      initialProgress: 0,
    });
    expect(surface.style.transform).toBe("translate3d(20px, 10px, 0) scale(0.9)");
    expect(surface.style.getPropertyValue("--taskmap-material-presence-progress")).toBe("0");
    expect(readMaterialPresentation(surface)).toEqual({
      opacity: 0,
      translateX: 20,
      translateY: 10,
      scale: 0.9,
    });
    motion.setProgress(1);
    expect(surface.style.transform).toBe("");
    expect(surface.style.getPropertyValue("--taskmap-material-presence-progress")).toBe("");
    expect(readMaterialPresentation(surface)).toEqual({
      opacity: 1,
      translateX: 0,
      translateY: 0,
      scale: 1,
    });
    motion.destroy();
  });

  it("never makes a surface created hidden inert when it heads straight to visible", () => {
    const surface = document.createElement("div");
    const inertWrites: boolean[] = [];
    Object.defineProperty(surface, "inert", {
      get: () => inertWrites[inertWrites.length - 1] ?? false,
      set: (value: boolean) => inertWrites.push(value),
    });
    const { scheduler, advance } = manualScheduler();
    const motion = createPresenceMotion(surface, {
      scheduler,
      reducedMotion: false,
      channels: { slide: { x: -100 } },
      enter: linear(100),
      initialProgress: 0,
      initialTarget: 1,
    });

    expect(motion.getSnapshot()).toMatchObject({ progress: 0, target: 1, phase: "showing" });
    advance(0);
    advance(100);
    expect(motion.getSnapshot()).toMatchObject({ progress: 1, phase: "visible" });
    expect(inertWrites).not.toContain(true);
    motion.destroy();
  });

  it("hides without inert when the owner hides the surface after its exit", () => {
    const surface = document.createElement("div");
    const { scheduler, advance } = manualScheduler();
    const motion = createPresenceMotion(surface, {
      scheduler,
      reducedMotion: false,
      channels: { slide: { x: -100 } },
      exit: linear(100),
      inertWhenHidden: false,
    });

    motion.hide();
    advance(0);
    advance(100);

    expect(motion.getSnapshot().phase).toBe("hidden");
    expect(surface.inert).toBe(false);
    expect(surface).toHaveAttribute("aria-hidden", "true");
    expect(surface.style.pointerEvents).toBe("none");
    motion.destroy();
  });

  it("uses separate enter and exit timing and completes at the endpoint", () => {
    const surface = document.createElement("div");
    const { scheduler, advance, active } = manualScheduler();
    const endpoints: string[] = [];
    const motion = createPresenceMotion(surface, {
      scheduler,
      reducedMotion: false,
      channels: { lift: 10 },
      enter: linear(200),
      exit: linear(100),
      initialProgress: 0,
      onComplete: (endpoint) => endpoints.push(endpoint),
    });
    motion.show();
    advance(100);
    expect(motion.getSnapshot().progress).toBeCloseTo(0.5);
    advance(100);
    expect(endpoints).toEqual(["visible"]);
    motion.hide();
    advance(50);
    expect(motion.getSnapshot().progress).toBeCloseTo(0.5);
    advance(50);
    expect(endpoints).toEqual(["visible", "hidden"]);
    expect(surface.inert).toBe(true);
    expect(active()).toBe(0);
    motion.destroy();
  });

  it("switches channels without leaving stale values from the previous combination", () => {
    const surface = document.createElement("div");
    const content = document.createElement("span");
    const { scheduler } = manualScheduler();
    const motion = createPresenceMotion(surface, {
      scheduler,
      reducedMotion: false,
      channels: { fade: true, scale: 0.9 },
      initialProgress: 0.5,
      contentTargets: () => [content],
    });
    expect(content.style.opacity).toBe("0.5");
    motion.setChannels({ slide: { y: 16 } });
    expect(content.style.opacity).toBe("");
    expect(surface.style.transform).toBe("translate3d(0px, 8px, 0)");
    motion.destroy();
    expect(surface.style.transform).toBe("");
  });
});

describe("cubic-bezier easing", () => {
  it("matches endpoints, linear control points and the emphasized curve's shape", () => {
    const linearCurve = cubicBezier(0.25, 0.25, 0.75, 0.75);
    expect(linearCurve(0)).toBe(0);
    expect(linearCurve(1)).toBe(1);
    expect(linearCurve(0.3)).toBeCloseTo(0.3, 4);
    const emphasized = cubicBezier(0.16, 1, 0.3, 1);
    expect(emphasized(0.2)).toBeGreaterThan(0.7);
    expect(emphasized(0.5)).toBeLessThanOrEqual(1);
  });
});
