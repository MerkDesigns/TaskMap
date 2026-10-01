import { describe, expect, it } from "vitest";
import { POINTER_TRAIL_CAPACITY, createPointerTrail } from "./pointerTrail";

const options = { spacing: 10, duration: 1000 };
const strengths = (points: Float32Array, count: number) =>
  Array.from({ length: count }, (_, index) => points[index * 4 + 2]);

describe("pointer trail", () => {
  it("keeps the live pointer at full strength", () => {
    const trail = createPointerTrail();
    trail.move(50, 60);

    const { points, count } = trail.sample(0, options);

    expect(Array.from(points.slice(0, 3))).toEqual([50, 60, 1]);
    expect(count).toBe(2);
  });

  it("fills fast moves with evenly spaced points", () => {
    const trail = createPointerTrail();
    trail.move(0, 0);
    trail.sample(0, options);
    trail.move(40, 0);

    const { points, count } = trail.sample(16, options);
    const xs = Array.from({ length: count - 1 }, (_, index) => points[(index + 1) * 4]);

    expect(xs).toEqual([0, 10, 20, 30, 40]);
  });

  it("fades points out over the trail duration after the pointer leaves", () => {
    const trail = createPointerTrail();
    trail.move(0, 0);
    trail.sample(0, options);
    trail.leave();

    const halfway = trail.sample(500, options);
    expect(strengths(halfway.points, halfway.count)).toEqual([0.25]);
    expect(trail.sample(1000, options).count).toBe(0);
  });

  it("never exceeds the shader capacity", () => {
    const trail = createPointerTrail();
    trail.move(0, 0);
    trail.sample(0, options);
    trail.move(10_000, 0);

    expect(trail.sample(16, options).count).toBe(POINTER_TRAIL_CAPACITY);
  });
});
