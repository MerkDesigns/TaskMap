// @vitest-environment node
import { describe, expect, it } from "vitest";
import { CanvasBrowserScrollState } from "./canvasBrowserScrollState";

describe("Canvas Browser smooth authoritative scroll state", () => {
  it("updates the wheel target immediately and approaches it over multiple frames", () => {
    const scroll = new CanvasBrowserScrollState();
    scroll.setRange(798, 1_844);
    scroll.requestWheelDelta(120);

    expect(scroll.snapshot()).toMatchObject({ currentScrollY: 0, targetScrollY: 120 });
    const firstFrame = scroll.tick(16);
    expect(firstFrame.currentScrollY).toBeGreaterThan(0);
    expect(firstFrame.currentScrollY).toBeLessThan(120);

    const secondFrame = scroll.tick(16);
    expect(secondFrame.currentScrollY).toBeGreaterThan(firstFrame.currentScrollY);
    expect(secondFrame.currentScrollY).toBeLessThan(120);
  });

  it("accumulates rapid arbitrary wheel deltas in its unquantized target", () => {
    const scroll = new CanvasBrowserScrollState();
    scroll.setRange(798, 1_844);
    scroll.requestWheelDelta(2.25);
    scroll.requestWheelDelta(1.5);

    expect(scroll.snapshot().targetScrollY).toBe(3.75);
    expect(scroll.tick(16).currentScrollY).toBeGreaterThan(0);
    expect(scroll.snapshot().currentScrollY).toBeLessThan(3.75);
  });

  it("settles exactly at the target", () => {
    const scroll = new CanvasBrowserScrollState();
    scroll.setRange(798, 1_844);
    scroll.requestWheelDelta(120);
    for (let frame = 0; frame < 100; frame += 1) scroll.tick(16);

    expect(scroll.snapshot()).toMatchObject({ currentScrollY: 120, targetScrollY: 120 });
  });

  it("clamps wheel, direct drag, and range changes at both bounds", () => {
    const scroll = new CanvasBrowserScrollState();
    scroll.setRange(798, 1_844);
    scroll.requestWheelDelta(2_000);
    expect(scroll.snapshot().targetScrollY).toBe(1_046);
    expect(scroll.tick(16, 2_000).currentScrollY).toBe(1_046);
    expect(scroll.snapshot().targetScrollY).toBe(1_046);

    scroll.setRange(798, 900);
    expect(scroll.snapshot()).toMatchObject({
      currentScrollY: 102,
      targetScrollY: 102,
      maximumScrollY: 102,
    });
    expect(scroll.tick(16, -2_000).currentScrollY).toBe(0);
    expect(scroll.snapshot().targetScrollY).toBe(0);
    scroll.requestWheelDelta(40);
    scroll.setRange(900, 798);
    expect(scroll.snapshot()).toMatchObject({
      currentScrollY: 0,
      targetScrollY: 0,
      maximumScrollY: 0,
    });
  });

  it("synchronizes the target to direct drag movement so wheel smoothing cannot pull back", () => {
    const scroll = new CanvasBrowserScrollState();
    scroll.setRange(798, 1_844);
    scroll.requestWheelDelta(300);
    scroll.tick(16);
    const dragged = scroll.tick(16, 16);

    expect(scroll.snapshot().targetScrollY).toBe(dragged.currentScrollY);
    expect(scroll.tick(16).changed).toBe(false);
  });
});
