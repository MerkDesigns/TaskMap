import { describe, expect, it } from "vitest";
import {
  advanceLiquidIndicator,
  createLiquidIndicatorState,
  LIQUID_MAX_RADIUS_PX,
  LIQUID_REST_RADIUS_PX,
  type LiquidIndicatorState,
  type LiquidIndicatorTarget,
} from "./liquidIndicatorMotion";

const frameMs = 1000 / 60;

function settle(
  initial: LiquidIndicatorState,
  target: LiquidIndicatorTarget,
): ReturnType<typeof advanceLiquidIndicator> {
  let frame = advanceLiquidIndicator(initial, target, frameMs);
  for (let index = 0; index < 360 && !frame.settled; index += 1) {
    frame = advanceLiquidIndicator(frame.state, target, frameMs);
  }
  return frame;
}

describe("liquid indicator motion", () => {
  it("moves left to right and stretches in the travel direction", () => {
    const target = { left: 160, width: 70 };
    const first = advanceLiquidIndicator(
      createLiquidIndicatorState({ left: 0, width: 70 }),
      target,
      frameMs,
    );
    expect(first.left).toBeGreaterThan(0);
    expect(first.width).toBeGreaterThan(70);
    expect(first.radius).toBeGreaterThan(LIQUID_REST_RADIUS_PX);
    expect(first.radius).toBeLessThanOrEqual(LIQUID_MAX_RADIUS_PX);
    expect(settle(first.state, target)).toMatchObject({
      left: 160,
      width: 70,
      radius: LIQUID_REST_RADIUS_PX,
      settled: true,
    });
  });

  it("stretches farther for longer travel", () => {
    const initial = createLiquidIndicatorState({ left: 0, width: 70 });
    const near = advanceLiquidIndicator(initial, { left: 40, width: 70 }, frameMs);
    const far = advanceLiquidIndicator(initial, { left: 240, width: 70 }, frameMs);
    expect(far.width - 70).toBeGreaterThan(near.width - 70);
  });

  it("moves right to left without inverting its edges", () => {
    const target = { left: 10, width: 54 };
    let frame = advanceLiquidIndicator(
      createLiquidIndicatorState({ left: 220, width: 90 }),
      target,
      frameMs,
    );
    expect(frame.left).toBeLessThan(220);
    for (let index = 0; index < 180 && !frame.settled; index += 1) {
      expect(frame.width).toBeGreaterThan(0);
      frame = advanceLiquidIndicator(frame.state, target, frameMs);
    }
    expect(frame).toMatchObject({ left: 10, width: 54, settled: true });
  });

  it("morphs to a variable-width target and settles exactly", () => {
    const target = { left: 100, width: 145 };
    const result = settle(createLiquidIndicatorState({ left: 0, width: 42 }), target);
    expect(result.left).toBe(100);
    expect(result.width).toBe(145);
  });

  it("retargets from its current animated state", () => {
    let frame = advanceLiquidIndicator(
      createLiquidIndicatorState({ left: 0, width: 60 }),
      { left: 200, width: 80 },
      frameMs,
    );
    for (let index = 0; index < 6; index += 1) {
      frame = advanceLiquidIndicator(frame.state, { left: 200, width: 80 }, frameMs);
    }
    const currentLeft = frame.left;
    const retargeted = advanceLiquidIndicator(frame.state, { left: 40, width: 120 }, frameMs);
    expect(retargeted.left).not.toBe(0);
    expect(Math.abs(retargeted.left - currentLeft)).toBeLessThan(100);
    expect(settle(retargeted.state, { left: 40, width: 120 })).toMatchObject({
      left: 40,
      width: 120,
      settled: true,
    });
  });

  it("survives rapid repeated retargeting", () => {
    let state = createLiquidIndicatorState({ left: 0, width: 60 });
    for (const target of [
      { left: 140, width: 80 },
      { left: 20, width: 130 },
      { left: 260, width: 45 },
      { left: 75, width: 96 },
    ]) {
      const frame = advanceLiquidIndicator(state, target, frameMs);
      expect(frame.width).toBeGreaterThan(0);
      state = frame.state;
    }
    expect(settle(state, { left: 75, width: 96 })).toMatchObject({
      left: 75,
      width: 96,
      settled: true,
    });
  });

  it("returns its bounded dynamic corner radius exactly to the rectangular rest value", () => {
    const target = { left: 260, width: 84 };
    let frame = advanceLiquidIndicator(
      createLiquidIndicatorState({ left: 0, width: 84 }),
      target,
      frameMs,
    );
    let maximumRadius = frame.radius;
    for (let index = 0; index < 360 && !frame.settled; index += 1) {
      expect(frame.radius).toBeGreaterThanOrEqual(LIQUID_REST_RADIUS_PX);
      expect(frame.radius).toBeLessThanOrEqual(LIQUID_MAX_RADIUS_PX);
      maximumRadius = Math.max(maximumRadius, frame.radius);
      frame = advanceLiquidIndicator(frame.state, target, frameMs);
    }
    expect(maximumRadius).toBeGreaterThan(LIQUID_REST_RADIUS_PX);
    expect(maximumRadius).toBe(LIQUID_MAX_RADIUS_PX);
    expect(LIQUID_MAX_RADIUS_PX).toBe(14);
    expect(frame.radius).toBe(LIQUID_REST_RADIUS_PX);
    expect(frame.settled).toBe(true);
  });

  it("settles immediately under reduced motion", () => {
    expect(
      advanceLiquidIndicator(
        createLiquidIndicatorState({ left: 0, width: 60 }),
        { left: 220, width: 110 },
        frameMs,
        true,
      ),
    ).toMatchObject({ left: 220, width: 110, settled: true });
  });
});
