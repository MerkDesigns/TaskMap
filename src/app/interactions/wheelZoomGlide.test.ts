// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createWheelZoomGlide } from "./wheelZoomGlide";

function setup(startZoom = 1) {
  let time = 0;
  let zoom = startZoom;
  const frames: Array<() => void> = [];
  const applied: number[] = [];
  const settled = vi.fn();
  const glide = createWheelZoomGlide({
    scheduler: {
      schedule: (callback) => frames.push(callback),
      cancel: () => frames.splice(0),
    },
    now: () => time,
    zoom: () => zoom,
    apply: (next) => {
      zoom = next;
      applied.push(next);
    },
    settled,
  });
  const runFrames = (count: number, frameMs = 16) => {
    for (let index = 0; index < count && frames.length > 0; index++) {
      time += frameMs;
      frames.shift()!();
    }
  };
  return { glide, applied, settled, runFrames, zoom: () => zoom, pending: () => frames.length };
}

describe("wheel zoom glide", () => {
  it("eases into the next step over several frames and settles on it exactly", () => {
    const { glide, applied, settled, runFrames, zoom } = setup();
    glide.wheel({ x: 10, y: 20 }, -100, 70);
    expect(applied).toEqual([]);

    runFrames(100);

    expect(applied.length).toBeGreaterThan(5);
    for (let index = 1; index < applied.length; index++) {
      expect(applied[index]).toBeGreaterThan(applied[index - 1]);
    }
    expect(zoom()).toBe(1.05);
    expect(settled).toHaveBeenCalledOnce();
  });

  it("joins a burst of notches into one motion towards their combined target", () => {
    const { glide, settled, runFrames, zoom } = setup();
    glide.wheel({ x: 0, y: 0 }, -100, 70);
    runFrames(2);
    glide.wheel({ x: 0, y: 0 }, -100, 70);
    glide.wheel({ x: 0, y: 0 }, -100, 70);
    runFrames(100);

    expect(zoom()).toBe(1.15);
    expect(settled).toHaveBeenCalledOnce();
  });

  it("reverses smoothly when the wheel turns the other way mid-glide", () => {
    const { glide, applied, runFrames, zoom } = setup();
    glide.wheel({ x: 0, y: 0 }, -100, 70);
    runFrames(3);
    const turned = zoom();
    glide.wheel({ x: 0, y: 0 }, 100, 70);
    glide.wheel({ x: 0, y: 0 }, 100, 70);
    runFrames(100);

    expect(applied.some((value) => value < turned)).toBe(true);
    expect(zoom()).toBe(0.95);
  });

  it("stops where it is when cancelled", () => {
    const { glide, settled, runFrames, pending, zoom } = setup();
    glide.wheel({ x: 0, y: 0 }, -100, 70);
    runFrames(2);
    const stopped = zoom();
    glide.cancel();

    expect(pending()).toBe(0);
    expect(zoom()).toBe(stopped);
    expect(settled).not.toHaveBeenCalled();
  });

  it("goes no further than the zoom range", () => {
    const { glide, runFrames, zoom } = setup(2.45);
    for (let notch = 0; notch < 5; notch++) glide.wheel({ x: 0, y: 0 }, -100, 70);
    runFrames(100);

    expect(zoom()).toBe(2.5);
  });
});
