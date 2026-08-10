import { describe, expect, it } from "vitest";
import {
  advanceLiquidToggle,
  createLiquidToggleState,
  LIQUID_TOGGLE_INSET_PX,
  LIQUID_TOGGLE_KNOB_SIZE_PX,
  LIQUID_TOGGLE_TRAVEL_PX,
} from "./liquidToggleMotion";

describe("liquid toggle motion", () => {
  it("stretches longer and thinner during travel before returning to a circle", () => {
    expect(LIQUID_TOGGLE_KNOB_SIZE_PX).toBe(22);
    let state = createLiquidToggleState(false);
    let maxWidth = LIQUID_TOGGLE_KNOB_SIZE_PX;
    let minHeight = LIQUID_TOGGLE_KNOB_SIZE_PX;
    let frame = advanceLiquidToggle(state, true, 1000 / 60);
    for (let index = 0; index < 240 && !frame.settled; index += 1) {
      state = frame.state;
      maxWidth = Math.max(maxWidth, frame.width);
      minHeight = Math.min(minHeight, frame.height);
      expect(frame.width).toBeGreaterThan(0);
      expect(frame.height).toBeGreaterThan(0);
      frame = advanceLiquidToggle(state, true, 1000 / 60);
    }
    expect(maxWidth).toBeGreaterThan(LIQUID_TOGGLE_KNOB_SIZE_PX + 5);
    expect(minHeight).toBeLessThan(LIQUID_TOGGLE_KNOB_SIZE_PX - 2);
    expect(frame.settled).toBe(true);
    expect(frame.x).toBe(LIQUID_TOGGLE_INSET_PX + LIQUID_TOGGLE_TRAVEL_PX);
    expect(frame.width).toBe(LIQUID_TOGGLE_KNOB_SIZE_PX);
    expect(frame.height).toBe(LIQUID_TOGGLE_KNOB_SIZE_PX);
    expect(frame.radius).toBe(LIQUID_TOGGLE_KNOB_SIZE_PX / 2);
  });

  it("retargets from its current state and settles without invalid geometry", () => {
    let frame = advanceLiquidToggle(createLiquidToggleState(false), true, 1000 / 60);
    for (let index = 0; index < 8; index += 1) {
      frame = advanceLiquidToggle(frame.state, true, 1000 / 60);
    }
    const retargetX = frame.x;
    frame = advanceLiquidToggle(frame.state, false, 1000 / 60);
    expect(Math.abs(frame.x - retargetX)).toBeLessThan(12);
    for (let index = 0; index < 240 && !frame.settled; index += 1) {
      expect(frame.width).toBeGreaterThan(0);
      expect(frame.height).toBeGreaterThan(0);
      frame = advanceLiquidToggle(frame.state, false, 1000 / 60);
    }
    expect(frame.settled).toBe(true);
    expect(frame.x).toBe(LIQUID_TOGGLE_INSET_PX);
  });

  it("settles immediately under reduced motion", () => {
    const frame = advanceLiquidToggle(createLiquidToggleState(false), true, 1000, true);
    expect(frame.settled).toBe(true);
    expect(frame.x).toBe(LIQUID_TOGGLE_INSET_PX + LIQUID_TOGGLE_TRAVEL_PX);
    expect(frame.width).toBe(LIQUID_TOGGLE_KNOB_SIZE_PX);
  });
});
