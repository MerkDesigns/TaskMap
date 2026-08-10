import { describe, expect, it, vi } from "vitest";
import { applyLocalFlip, calculateFlipTransform } from "./layoutMotion";
import { createMotionFrameScheduler, type MotionFrameDriver } from "./motionFrameScheduler";

describe("layout motion", () => {
  it("calculates local FLIP position and resize inversion", () => {
    expect(
      calculateFlipTransform(
        { left: 10, top: 20, width: 100, height: 40 },
        { left: 50, top: 35, width: 200, height: 20 },
      ),
    ).toEqual({ translateX: -40, translateY: -15, scaleX: 0.5, scaleY: 2 });
  });

  it("avoids invalid scaling for collapsed target geometry", () => {
    expect(
      calculateFlipTransform(
        { left: 0, top: 0, width: 10, height: 10 },
        { left: 0, top: 0, width: 0, height: 0 },
      ),
    ).toMatchObject({ scaleX: 1, scaleY: 1 });
  });

  it("drives FLIP transforms through the shared scheduler and stops geometry work at settlement", () => {
    const driver = new ControlledFrameDriver();
    const scheduler = createMotionFrameScheduler(driver);
    const element = document.createElement("div");
    const notifyGeometryChanged = vi.fn();

    applyLocalFlip(
      element,
      { left: 10, top: 20, width: 100, height: 40 },
      { left: 50, top: 35, width: 100, height: 40 },
      scheduler,
      false,
      notifyGeometryChanged,
    );

    expect(element.style.transform).toContain("translate3d(-40px, -15px, 0)");
    expect(scheduler.getSnapshot()).toEqual({ subscriberCount: 1, framePending: true });
    driver.flush();
    expect(element.style.transform).toBe("");
    expect(element.style.willChange).toBe("");
    expect(scheduler.getSnapshot()).toEqual({ subscriberCount: 0, framePending: false });
    const settledCalls = notifyGeometryChanged.mock.calls.length;
    expect(driver.fire()).toBe(false);
    expect(notifyGeometryChanged).toHaveBeenCalledTimes(settledCalls);
    scheduler.dispose();
  });

  it("settles reduced-motion FLIP immediately without subscribing", () => {
    const driver = new ControlledFrameDriver();
    const scheduler = createMotionFrameScheduler(driver);
    const element = document.createElement("div");
    const notifyGeometryChanged = vi.fn();

    applyLocalFlip(
      element,
      { left: 0, top: 100, width: 100, height: 40 },
      { left: 0, top: 0, width: 100, height: 40 },
      scheduler,
      true,
      notifyGeometryChanged,
    );

    expect(element.style.transform).toBe("");
    expect(notifyGeometryChanged).toHaveBeenCalledOnce();
    expect(scheduler.getSnapshot()).toEqual({ subscriberCount: 0, framePending: false });
    scheduler.dispose();
  });
});

class ControlledFrameDriver implements MotionFrameDriver {
  private callbacks = new Map<number, (timestampMs: number) => void>();
  private nextHandle = 1;
  private timestampMs = 0;

  request(callback: (timestampMs: number) => void): number {
    const handle = this.nextHandle++;
    this.callbacks.set(handle, callback);
    return handle;
  }

  cancel(handle: number): void {
    this.callbacks.delete(handle);
  }

  fire(): boolean {
    const entry = this.callbacks.entries().next().value as
      [number, (timestampMs: number) => void] | undefined;
    if (!entry) return false;
    this.callbacks.delete(entry[0]);
    this.timestampMs += 1000 / 60;
    entry[1](this.timestampMs);
    return true;
  }

  flush(limit = 60): void {
    for (let frame = 0; frame < limit && this.fire(); frame += 1) {
      // One shared frame remains pending only while motion subscribers are active.
    }
  }
}
