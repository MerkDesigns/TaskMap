import { describe, expect, it, vi } from "vitest";
import {
  createMotionFrameScheduler,
  type MotionFrameDriver,
  type MotionFrameSubscriber,
} from "./motionFrameScheduler";
import { MOTION_MAX_FRAME_DELTA_MS } from "./motionTokens";

class ControlledFrameDriver implements MotionFrameDriver {
  readonly callbacks = new Map<number, (timestampMs: number) => void>();
  readonly cancelled: number[] = [];
  nextHandle = 1;

  request(callback: (timestampMs: number) => void): number {
    const handle = this.nextHandle;
    this.nextHandle += 1;
    this.callbacks.set(handle, callback);
    return handle;
  }

  cancel(handle: number): void {
    this.cancelled.push(handle);
    this.callbacks.delete(handle);
  }

  fire(timestampMs: number): void {
    const entry = this.callbacks.entries().next().value as
      [number, (timestampMs: number) => void] | undefined;
    if (!entry) throw new Error("No frame is pending");
    this.callbacks.delete(entry[0]);
    entry[1](timestampMs);
  }
}

describe("motion frame scheduler", () => {
  it("shares one pending frame across many motion subscribers", () => {
    const driver = new ControlledFrameDriver();
    const scheduler = createMotionFrameScheduler(driver);
    const listeners = Array.from({ length: 120 }, () => vi.fn<MotionFrameSubscriber>(() => false));
    listeners.forEach((listener) => scheduler.subscribe(listener));
    expect(driver.callbacks.size).toBe(1);
    expect(scheduler.getSnapshot()).toEqual({ subscriberCount: 120, framePending: true });
    driver.fire(16);
    expect(listeners.every((listener) => listener.mock.calls.length === 1)).toBe(true);
    expect(scheduler.getSnapshot()).toEqual({ subscriberCount: 0, framePending: false });
  });

  it("continues only while work remains and stops when idle", () => {
    const driver = new ControlledFrameDriver();
    const scheduler = createMotionFrameScheduler(driver);
    let frames = 0;
    scheduler.subscribe(() => {
      frames += 1;
      return frames < 3;
    });
    driver.fire(10);
    driver.fire(20);
    driver.fire(30);
    expect(frames).toBe(3);
    expect(driver.callbacks.size).toBe(0);
  });

  it("supports safe repeated unsubscribe and cancels an orphaned frame", () => {
    const driver = new ControlledFrameDriver();
    const scheduler = createMotionFrameScheduler(driver);
    const unsubscribe = scheduler.subscribe(() => true);
    unsubscribe();
    unsubscribe();
    expect(driver.cancelled).toEqual([1]);
    expect(scheduler.getSnapshot()).toEqual({ subscriberCount: 0, framePending: false });
  });

  it("clamps delta after a debugger or background pause", () => {
    const driver = new ControlledFrameDriver();
    const scheduler = createMotionFrameScheduler(driver);
    const deltas: number[] = [];
    scheduler.subscribe(({ deltaMs }) => {
      deltas.push(deltaMs);
      return deltas.length < 2;
    });
    driver.fire(10);
    driver.fire(10_000);
    expect(deltas[1]).toBe(MOTION_MAX_FRAME_DELTA_MS);
  });
});
