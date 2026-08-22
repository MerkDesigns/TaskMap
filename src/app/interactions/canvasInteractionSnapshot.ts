import type { CanvasViewport } from "../../canvas/geometry/viewportMath";
import type { CanvasInteractionSnapshot } from "./canvasInteractionTypes";

export function idleCanvasInteractionSnapshot(
  canvasKey: string,
  viewport: CanvasViewport,
): CanvasInteractionSnapshot {
  return {
    canvasKey,
    viewport,
    activeInteraction: null,
    selectedIds: [],
    selectionPreviewIds: [],
    selectionRectangle: null,
    geometryPreviews: [],
    snapGuides: [],
  };
}
