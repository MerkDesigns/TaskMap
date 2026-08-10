import {
  advanceScalarSpring,
  isScalarSpringSettled,
  settleScalarSpring,
  type ScalarSpringState,
} from "./motionMath";
import { SPRING } from "./motionTokens";

export const LIQUID_TOGGLE_TRACK_WIDTH_PX = 52;
export const LIQUID_TOGGLE_TRACK_HEIGHT_PX = 30;
export const LIQUID_TOGGLE_INSET_PX = 3;
export const LIQUID_TOGGLE_KNOB_SIZE_PX = 22;
export const LIQUID_TOGGLE_TRAVEL_PX =
  LIQUID_TOGGLE_TRACK_WIDTH_PX - LIQUID_TOGGLE_KNOB_SIZE_PX - LIQUID_TOGGLE_INSET_PX * 2;

const MAX_STRETCH_PX = 8;
const MAX_THIN_PX = 4;
const DEFORMATION_VELOCITY = 140;
const MAX_OVERSHOOT_PX = 2;

export interface LiquidToggleState {
  readonly position: ScalarSpringState;
}

export interface LiquidToggleFrame {
  readonly state: LiquidToggleState;
  readonly x: number;
  readonly width: number;
  readonly height: number;
  readonly radius: number;
  readonly settled: boolean;
}

export function createLiquidToggleState(checked: boolean): LiquidToggleState {
  return Object.freeze({
    position: settleScalarSpring(checked ? LIQUID_TOGGLE_TRAVEL_PX : 0),
  });
}

export function advanceLiquidToggle(
  state: LiquidToggleState,
  checked: boolean,
  deltaMs: number,
  reducedMotion = false,
): LiquidToggleFrame {
  const target = checked ? LIQUID_TOGGLE_TRAVEL_PX : 0;
  if (reducedMotion) return settledLiquidToggle(checked);
  const position = advanceScalarSpring(state.position, target, SPRING.liquid, deltaMs);
  if (isScalarSpringSettled(position, target, SPRING.liquid)) return settledLiquidToggle(checked);

  const deformation = Math.min(1, Math.abs(position.velocity) / DEFORMATION_VELOCITY);
  const width = LIQUID_TOGGLE_KNOB_SIZE_PX + MAX_STRETCH_PX * deformation;
  const height = LIQUID_TOGGLE_KNOB_SIZE_PX - MAX_THIN_PX * deformation;
  const boundedPosition = Math.max(
    -MAX_OVERSHOOT_PX,
    Math.min(LIQUID_TOGGLE_TRAVEL_PX + MAX_OVERSHOOT_PX, position.position),
  );
  return Object.freeze({
    state: Object.freeze({ position }),
    x: LIQUID_TOGGLE_INSET_PX + boundedPosition - (width - LIQUID_TOGGLE_KNOB_SIZE_PX) / 2,
    width,
    height,
    radius: height / 2,
    settled: false,
  });
}

function settledLiquidToggle(checked: boolean): LiquidToggleFrame {
  const state = createLiquidToggleState(checked);
  return Object.freeze({
    state,
    x: LIQUID_TOGGLE_INSET_PX + (checked ? LIQUID_TOGGLE_TRAVEL_PX : 0),
    width: LIQUID_TOGGLE_KNOB_SIZE_PX,
    height: LIQUID_TOGGLE_KNOB_SIZE_PX,
    radius: LIQUID_TOGGLE_KNOB_SIZE_PX / 2,
    settled: true,
  });
}
