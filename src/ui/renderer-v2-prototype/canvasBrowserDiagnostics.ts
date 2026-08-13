export const CANVAS_BROWSER_DIAGNOSTIC_MODES = [
  "full",
  "no-card-html",
  "no-card-glass",
  "no-card-glass-or-html",
  "render-on-demand",
] as const;

export type CanvasBrowserDiagnosticMode = (typeof CANVAS_BROWSER_DIAGNOSTIC_MODES)[number];
export const DEFAULT_CANVAS_BROWSER_DIAGNOSTIC_MODE: CanvasBrowserDiagnosticMode =
  "render-on-demand";

export const CANVAS_BROWSER_DIAGNOSTIC_LABELS: Record<CanvasBrowserDiagnosticMode, string> = {
  full: "FULL",
  "no-card-html": "NO CARD HTML",
  "no-card-glass": "NO CARD GLASS",
  "no-card-glass-or-html": "NO CARD GLASS + NO CARD HTML",
  "render-on-demand": "RENDER ON DEMAND EXPERIMENT",
};

export function canvasBrowserDiagnosticFeatures(mode: CanvasBrowserDiagnosticMode) {
  return {
    cardGlass: mode !== "no-card-glass" && mode !== "no-card-glass-or-html",
    cardHtml: mode !== "no-card-html" && mode !== "no-card-glass-or-html",
    placeholder: mode === "no-card-glass-or-html",
    renderOnDemand: mode === "render-on-demand",
  } as const;
}

export function canvasBrowserNeedsContinuousFrames(
  mode: CanvasBrowserDiagnosticMode,
  animationsActive: boolean,
  timedSampleRunning: boolean,
) {
  return (
    !canvasBrowserDiagnosticFeatures(mode).renderOnDemand || animationsActive || timedSampleRunning
  );
}
