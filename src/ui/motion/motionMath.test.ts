import { describe, expect, it } from "vitest";
import {
  advanceScalarSpring,
  clampFrameDelta,
  isScalarSpringSettled,
  settleScalarSpring,
} from "./motionMath";
import { MOTION_MAX_FRAME_DELTA_MS, SPRING } from "./motionTokens";

describe("motion math", () => {
  it("converges a scalar spring and settles within the central epsilon", () => {
    let state = settleScalarSpring(0);
    for (let frame = 0; frame < 240; frame += 1) {
      state = advanceScalarSpring(state, 100, SPRING.snappy, 1000 / 60);
    }
    expect(isScalarSpringSettled(state, 100, SPRING.snappy)).toBe(true);
    expect(state.position).toBeCloseTo(100, 3);
  });

  it("remains effectively frame-rate independent", () => {
    let sixtyFps = settleScalarSpring(0);
    let oneTwentyFps = settleScalarSpring(0);
    for (let frame = 0; frame < 60; frame += 1) {
      sixtyFps = advanceScalarSpring(sixtyFps, 80, SPRING.liquid, 1000 / 60);
    }
    for (let frame = 0; frame < 120; frame += 1) {
      oneTwentyFps = advanceScalarSpring(oneTwentyFps, 80, SPRING.liquid, 1000 / 120);
    }
    expect(sixtyFps.position).toBeCloseTo(oneTwentyFps.position, 8);
    expect(sixtyFps.velocity).toBeCloseTo(oneTwentyFps.velocity, 8);
  });

  it("retargets from the current position and velocity", () => {
    let state = settleScalarSpring(0);
    for (let frame = 0; frame < 8; frame += 1) {
      state = advanceScalarSpring(state, 100, SPRING.liquid, 1000 / 60);
    }
    const midFlight = state;
    const retargeted = advanceScalarSpring(state, -40, SPRING.liquid, 1000 / 60);
    expect(midFlight.position).toBeGreaterThan(0);
    expect(retargeted.position).not.toBe(0);
    expect(retargeted.position).not.toBe(-40);
  });

  it("clamps pathological frame deltas", () => {
    expect(clampFrameDelta(5_000)).toBe(MOTION_MAX_FRAME_DELTA_MS);
    expect(clampFrameDelta(Number.NaN)).toBe(0);
    expect(advanceScalarSpring(settleScalarSpring(0), 100, SPRING.soft, 5_000)).toEqual(
      advanceScalarSpring(settleScalarSpring(0), 100, SPRING.soft, 48),
    );
  });
});
