import { MOTION_MAX_FRAME_DELTA_MS, type SpringConfiguration } from "./motionTokens";

export interface ScalarSpringState {
  readonly position: number;
  readonly velocity: number;
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function interpolate(from: number, to: number, progress: number): number {
  return from + (to - from) * clamp(progress, 0, 1);
}

export function normalizedProgress(value: number, from: number, to: number): number {
  if (from === to) return 1;
  return clamp((value - from) / (to - from), 0, 1);
}

export function clampFrameDelta(deltaMs: number): number {
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) return 0;
  return Math.min(deltaMs, MOTION_MAX_FRAME_DELTA_MS);
}

/** Exact damped-oscillator integration, stable across ordinary frame intervals. */
export function advanceScalarSpring(
  state: ScalarSpringState,
  target: number,
  configuration: SpringConfiguration,
  deltaMs: number,
): ScalarSpringState {
  const seconds = clampFrameDelta(deltaMs) / 1000;
  if (seconds === 0) return state;
  const { stiffness, damping, mass } = configuration;
  if (
    !Number.isFinite(target) ||
    !Number.isFinite(state.position) ||
    !Number.isFinite(state.velocity) ||
    stiffness <= 0 ||
    damping < 0 ||
    mass <= 0
  ) {
    throw new RangeError("Spring state and configuration must be finite and physically valid");
  }

  const displacement = state.position - target;
  const angularFrequency = Math.sqrt(stiffness / mass);
  const dampingRatio = damping / (2 * Math.sqrt(stiffness * mass));
  let nextDisplacement: number;
  let nextVelocity: number;

  if (dampingRatio < 1 - 1e-6) {
    const decayRate = dampingRatio * angularFrequency;
    const dampedFrequency = angularFrequency * Math.sqrt(1 - dampingRatio * dampingRatio);
    const coefficient = (state.velocity + decayRate * displacement) / dampedFrequency;
    const cosine = Math.cos(dampedFrequency * seconds);
    const sine = Math.sin(dampedFrequency * seconds);
    const decay = Math.exp(-decayRate * seconds);
    const wave = displacement * cosine + coefficient * sine;
    nextDisplacement = decay * wave;
    nextVelocity =
      decay *
      (-decayRate * wave -
        displacement * dampedFrequency * sine +
        coefficient * dampedFrequency * cosine);
  } else if (dampingRatio > 1 + 1e-6) {
    const root = Math.sqrt(dampingRatio * dampingRatio - 1);
    const rateOne = -angularFrequency * (dampingRatio - root);
    const rateTwo = -angularFrequency * (dampingRatio + root);
    const coefficientOne = (state.velocity - rateTwo * displacement) / (rateOne - rateTwo);
    const coefficientTwo = displacement - coefficientOne;
    const exponentialOne = Math.exp(rateOne * seconds);
    const exponentialTwo = Math.exp(rateTwo * seconds);
    nextDisplacement = coefficientOne * exponentialOne + coefficientTwo * exponentialTwo;
    nextVelocity =
      coefficientOne * rateOne * exponentialOne + coefficientTwo * rateTwo * exponentialTwo;
  } else {
    const coefficient = state.velocity + angularFrequency * displacement;
    const decay = Math.exp(-angularFrequency * seconds);
    nextDisplacement = (displacement + coefficient * seconds) * decay;
    nextVelocity =
      (coefficient - angularFrequency * (displacement + coefficient * seconds)) * decay;
  }

  return Object.freeze({ position: target + nextDisplacement, velocity: nextVelocity });
}

export function isScalarSpringSettled(
  state: ScalarSpringState,
  target: number,
  configuration: SpringConfiguration,
): boolean {
  return (
    Math.abs(state.position - target) <= configuration.positionEpsilon &&
    Math.abs(state.velocity) <= configuration.velocityEpsilon
  );
}

export function settleScalarSpring(target: number): ScalarSpringState {
  return Object.freeze({ position: target, velocity: 0 });
}
