import {
  advanceScalarSpring,
  clamp,
  isScalarSpringSettled,
  settleScalarSpring,
  type ScalarSpringState,
} from "./motionMath";
import { SPRING } from "./motionTokens";

/** Where a liquid cell indicator rests: the centre of a square cell and the cell's side. */
export interface LiquidCellTarget {
  readonly x: number;
  readonly y: number;
  readonly size: number;
}

interface PointSpring {
  readonly x: ScalarSpringState;
  readonly y: ScalarSpringState;
}

/**
 * Two centres chase the target: the leading one on a snappy spring, the trailing one on a soft
 * spring. The indicator is the capsule spanning both, so it stretches along whatever direction it
 * travels, diagonals included, and contracts as the trailing centre catches up.
 */
export interface LiquidCellState {
  readonly lead: PointSpring;
  readonly trail: PointSpring;
}

export interface LiquidCellFrame {
  readonly state: LiquidCellState;
  /** The capsule's centre. */
  readonly x: number;
  readonly y: number;
  /** Along the direction of travel; the cell size at rest. */
  readonly length: number;
  /** Across the direction of travel; always the cell size. */
  readonly thickness: number;
  /** Rotation in degrees, kept within ±90° since a capsule looks the same turned half a circle. */
  readonly angle: number;
  readonly radius: number;
  readonly settled: boolean;
}

/** The stretch, as a share of the cell size, at which the indicator is fully round and fully turned. */
const FULL_STRETCH_RATIO = 0.3;

export function createLiquidCellState(target: LiquidCellTarget): LiquidCellState {
  const point = Object.freeze({ x: settleScalarSpring(target.x), y: settleScalarSpring(target.y) });
  return Object.freeze({ lead: point, trail: point });
}

export function advanceLiquidCell(
  state: LiquidCellState,
  target: LiquidCellTarget,
  deltaMs: number,
  settledRadius: number,
  reducedMotion = false,
  rigid = false,
): LiquidCellFrame {
  if (!Number.isFinite(target.x) || !Number.isFinite(target.y) || !(target.size > 0)) {
    throw new RangeError("Liquid cell geometry must be finite and positive");
  }
  if (reducedMotion) return settledFrame(target, settledRadius);
  // Rigid, both centres share the snappy spring: the shape glides without stretching.
  const lead = advancePoint(state.lead, target, SPRING.snappy, deltaMs);
  const trail = advancePoint(state.trail, target, rigid ? SPRING.snappy : SPRING.soft, deltaMs);
  if (pointSettled(lead, target) && pointSettled(trail, target)) {
    return settledFrame(target, settledRadius);
  }
  const next = Object.freeze({ lead, trail });
  return frameFor(next, target.size, settledRadius);
}

/** The frame for a state as it stands, e.g. the first frame before any time has passed. */
export function liquidCellFrame(
  state: LiquidCellState,
  size: number,
  settledRadius: number,
): LiquidCellFrame {
  return frameFor(state, size, settledRadius);
}

function frameFor(state: LiquidCellState, size: number, settledRadius: number): LiquidCellFrame {
  const dx = state.lead.x.position - state.trail.x.position;
  const dy = state.lead.y.position - state.trail.y.position;
  const distance = Math.hypot(dx, dy);
  const stretch = smoothstep(clamp(distance / (size * FULL_STRETCH_RATIO), 0, 1));
  let angle = distance > 0 ? (Math.atan2(dy, dx) * 180) / Math.PI : 0;
  if (angle > 90) angle -= 180;
  if (angle < -90) angle += 180;
  return Object.freeze({
    state,
    x: (state.lead.x.position + state.trail.x.position) / 2,
    y: (state.lead.y.position + state.trail.y.position) / 2,
    length: size + distance,
    thickness: size,
    // Barely stretched, the shape is still nearly square, so it turns only as it rounds; it never
    // shows as a tilted square while settling.
    angle: angle * stretch,
    radius: settledRadius + stretch * (size / 2 - settledRadius),
    // Only reaching the target settles it; both centres also coincide before a move starts.
    settled: false,
  });
}

function settledFrame(target: LiquidCellTarget, settledRadius: number): LiquidCellFrame {
  return Object.freeze({
    state: createLiquidCellState(target),
    x: target.x,
    y: target.y,
    length: target.size,
    thickness: target.size,
    angle: 0,
    radius: settledRadius,
    settled: true,
  });
}

function advancePoint(
  point: PointSpring,
  target: LiquidCellTarget,
  spring: typeof SPRING.snappy,
  deltaMs: number,
): PointSpring {
  return Object.freeze({
    x: advanceScalarSpring(point.x, target.x, spring, deltaMs),
    y: advanceScalarSpring(point.y, target.y, spring, deltaMs),
  });
}

function pointSettled(point: PointSpring, target: LiquidCellTarget): boolean {
  return (
    isScalarSpringSettled(point.x, target.x, SPRING.liquid) &&
    isScalarSpringSettled(point.y, target.y, SPRING.liquid)
  );
}

function smoothstep(progress: number): number {
  return progress * progress * (3 - 2 * progress);
}
