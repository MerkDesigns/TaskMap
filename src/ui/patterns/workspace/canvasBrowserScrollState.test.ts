// @vitest-environment node
import { describe, expect, it } from "vitest";
import { CanvasBrowserScrollState } from "./canvasBrowserScrollState";
import {
  CANVAS_BROWSER_WHEEL_DELTA_SCALE,
  convertCanvasBrowserWheelDelta,
} from "./canvasBrowserWheelDelta";

describe("Canvas Browser authoritative smooth scroll", () => {
  it("normalizes pixel, line, and page wheel input by exactly 0.45", () => {
    expect(CANVAS_BROWSER_WHEEL_DELTA_SCALE).toBe(0.45);
    expect(convertCanvasBrowserWheelDelta(100, 0, 500)).toBe(45);
    expect(convertCanvasBrowserWheelDelta(3, 1, 500)).toBeCloseTo(21.6);
    expect(convertCanvasBrowserWheelDelta(1, 2, 500)).toBe(225);
  });

  it("approaches the unquantized target with the 45ms time constant and settles exactly", () => {
    const scroll = new CanvasBrowserScrollState();
    scroll.setRange(798, 1_844);
    scroll.requestWheelDelta(120);
    const first = scroll.tick(16);

    expect(first.currentScrollY).toBeGreaterThan(0);
    expect(first.currentScrollY).toBeLessThan(120);
    expect(first.currentScrollY).toBeCloseTo(120 * (1 - Math.exp(-16 / 45)));
    for (let frame = 0; frame < 100; frame += 1) scroll.tick(16);
    expect(scroll.snapshot()).toMatchObject({ currentScrollY: 120, targetScrollY: 120 });
  });

  it("synchronizes direct drag auto-scroll so wheel smoothing cannot pull backward", () => {
    const scroll = new CanvasBrowserScrollState();
    scroll.setRange(300, 1_000);
    scroll.requestWheelDelta(300);
    scroll.tick(16);
    const dragged = scroll.tick(16, 16);

    expect(scroll.snapshot().targetScrollY).toBe(dragged.currentScrollY);
    expect(scroll.tick(16).changed).toBe(false);
  });
});
