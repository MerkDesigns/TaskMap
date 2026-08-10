// Central Phase 4.5C motion values; these are UI-motion values, not compositor constants.
export const MOTION_DURATION_MS = Object.freeze({
  instant: 0,
  fast: 120,
  menuExit: 90,
  normal: 180,
  slow: 280,
});

export const MOTION_EASING = Object.freeze({
  standard: "cubic-bezier(0.2, 0, 0, 1)",
  emphasized: "cubic-bezier(0.16, 1, 0.3, 1)",
});

export interface SpringConfiguration {
  readonly stiffness: number;
  readonly damping: number;
  readonly mass: number;
  readonly positionEpsilon: number;
  readonly velocityEpsilon: number;
}

export const SPRING = Object.freeze({
  snappy: spring(560, 38, 1, 0.08, 0.08),
  soft: spring(240, 28, 1, 0.08, 0.08),
  liquid: spring(300, 28, 1, 0.08, 0.08),
});

export const MOTION_MAX_FRAME_DELTA_MS = 48;
export const MOTION_DEFAULT_FRAME_DELTA_MS = 1000 / 60;

function spring(
  stiffness: number,
  damping: number,
  mass: number,
  positionEpsilon: number,
  velocityEpsilon: number,
): Readonly<SpringConfiguration> {
  return Object.freeze({ stiffness, damping, mass, positionEpsilon, velocityEpsilon });
}
