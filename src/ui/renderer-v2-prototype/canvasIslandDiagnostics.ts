export const CANVAS_ISLAND_DIAGNOSTIC_MODES = ["coarse-canvas", "dynamic-islands"] as const;

export type CanvasIslandDiagnosticMode = (typeof CANVAS_ISLAND_DIAGNOSTIC_MODES)[number];

export const DEFAULT_CANVAS_ISLAND_DIAGNOSTIC_MODE: CanvasIslandDiagnosticMode = "dynamic-islands";

export const CANVAS_ISLAND_DIAGNOSTIC_LABELS: Record<CanvasIslandDiagnosticMode, string> = {
  "coarse-canvas": "COARSE CANVAS",
  "dynamic-islands": "DYNAMIC ISLANDS",
};
