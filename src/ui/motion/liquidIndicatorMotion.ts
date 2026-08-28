import {
  advanceScalarSpring,
  isScalarSpringSettled,
  settleScalarSpring,
  type ScalarSpringState,
} from "./motionMath";
import { SPRING } from "./motionTokens";

export interface HorizontalLiquidIndicatorTarget {
  readonly orientation?: "horizontal";
  readonly left: number;
  readonly width: number;
}

export interface VerticalLiquidIndicatorTarget {
  readonly orientation: "vertical";
  readonly top: number;
  readonly height: number;
}

export type LiquidIndicatorTarget = HorizontalLiquidIndicatorTarget | VerticalLiquidIndicatorTarget;

export interface LiquidIndicatorState {
  readonly left: ScalarSpringState;
  readonly right: ScalarSpringState;
}

export interface LiquidIndicatorFrame {
  readonly state: LiquidIndicatorState;
  readonly left: number;
  readonly width: number;
  readonly radius: number;
  readonly settled: boolean;
}

const MIN_INDICATOR_WIDTH = 1;
export const LIQUID_REST_RADIUS_PX = 7;
export const LIQUID_MAX_RADIUS_PX = 16;
const MAX_RADIUS_STRETCH_RATIO = 0.28;

export function createLiquidIndicatorState(target: LiquidIndicatorTarget): LiquidIndicatorState {
  const normalized = normalizeTarget(target);
  return Object.freeze({
    left: settleScalarSpring(normalized.left),
    right: settleScalarSpring(normalized.left + normalized.width),
  });
}

export function advanceLiquidIndicator(
  state: LiquidIndicatorState,
  target: LiquidIndicatorTarget,
  deltaMs: number,
  reducedMotion = false,
): LiquidIndicatorFrame {
  const normalized = normalizeTarget(target);
  const targetRight = normalized.left + normalized.width;
  if (reducedMotion) return settledFrame(normalized);

  const currentCenter = (state.left.position + state.right.position) / 2;
  const targetCenter = normalized.left + normalized.width / 2;
  const movingRight = targetCenter >= currentCenter;
  let left = advanceScalarSpring(
    state.left,
    normalized.left,
    movingRight ? SPRING.soft : SPRING.snappy,
    deltaMs,
  );
  let right = advanceScalarSpring(
    state.right,
    targetRight,
    movingRight ? SPRING.snappy : SPRING.soft,
    deltaMs,
  );

  if (right.position - left.position < MIN_INDICATOR_WIDTH) {
    const center = (left.position + right.position) / 2;
    const velocity = (left.velocity + right.velocity) / 2;
    left = Object.freeze({ position: center - MIN_INDICATOR_WIDTH / 2, velocity });
    right = Object.freeze({ position: center + MIN_INDICATOR_WIDTH / 2, velocity });
  }

  const settled =
    isScalarSpringSettled(left, normalized.left, SPRING.liquid) &&
    isScalarSpringSettled(right, targetRight, SPRING.liquid);
  if (settled) return settledFrame(normalized);
  const nextState = Object.freeze({ left, right });
  const width = Math.max(MIN_INDICATOR_WIDTH, right.position - left.position);
  return Object.freeze({
    state: nextState,
    left: left.position,
    width,
    radius: liquidRadiusForStretch(width, normalized.width),
    settled: false,
  });
}

function settledFrame(target: LiquidIndicatorTarget): LiquidIndicatorFrame {
  const normalized = normalizeTarget(target);
  const state = createLiquidIndicatorState(normalized);
  return Object.freeze({
    state,
    left: normalized.left,
    width: normalized.width,
    radius: LIQUID_REST_RADIUS_PX,
    settled: true,
  });
}

export function liquidRadiusForStretch(width: number, targetWidth: number): number {
  const safeTargetWidth = Math.max(MIN_INDICATOR_WIDTH, targetWidth);
  const stretchRatio = Math.abs(width - safeTargetWidth) / safeTargetWidth;
  const progress = Math.min(1, stretchRatio / MAX_RADIUS_STRETCH_RATIO);
  return LIQUID_REST_RADIUS_PX + progress * (LIQUID_MAX_RADIUS_PX - LIQUID_REST_RADIUS_PX);
}

function normalizeTarget(target: LiquidIndicatorTarget): HorizontalLiquidIndicatorTarget {
  const left = "top" in target ? target.top : target.left;
  const width = "height" in target ? target.height : target.width;
  if (!Number.isFinite(left) || !Number.isFinite(width)) {
    throw new RangeError("Liquid indicator geometry must be finite");
  }
  return Object.freeze({ left, width: Math.max(MIN_INDICATOR_WIDTH, width) });
}
