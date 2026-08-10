/**
 * Typed, DOM-free mirror of the normative visible workspace values in theme.css.
 * BackdropScene projection cannot read computed CSS; Phase 4.5C2A parity tests enforce this mirror.
 */
export const WORKSPACE_VISUAL_VALUES = Object.freeze({
  voidBackground: "#0b0b0c",
  canvasBackground: "#0f1011",
  canvasDotRgb: Object.freeze([70, 79, 96] as const),
  canvasLineRgb: Object.freeze([88, 101, 124] as const),
  canvasMajorLineRgb: Object.freeze([118, 136, 164] as const),
  canvasGridSpacingWorld: 24,
  canvasGridMajorEvery: 5,
  canvasLineMinorOpacityScale: 0.62,
  canvasLineMajorOpacityScale: 0.48,
  canvasDotRadiusScreen: 1.25,
  canvasDotOpacityFadeStart: 0.55,
  canvasDotOpacityFadeSpan: 0.45,
  canvasCornerRadius: 24,
});

export function formatWorkspaceRgb(
  rgb: readonly [number, number, number],
  opacity: number,
): string {
  return `rgb(${rgb.join(" ")} / ${opacity})`;
}
