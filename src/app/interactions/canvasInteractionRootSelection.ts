import { shouldRefreshCullingViewport } from "../../canvas/virtualization/viewportCulling";
import type { CanvasInteractionSnapshot } from "./canvasInteractionTypes";

export function canvasInteractionRootSnapshotsEqual(
  previous: CanvasInteractionSnapshot,
  next: CanvasInteractionSnapshot,
): boolean {
  if (previous === next) return true;
  if (
    previous.canvasKey !== next.canvasKey ||
    previous.activeInteraction !== next.activeInteraction ||
    previous.selectedIds !== next.selectedIds ||
    previous.selectionPreviewIds !== next.selectionPreviewIds ||
    previous.selectionRectangle !== next.selectionRectangle ||
    previous.geometryPreviews !== next.geometryPreviews ||
    previous.snapGuides !== next.snapGuides
  ) {
    return false;
  }

  if (next.activeInteraction?.kind !== "pan") return false;
  return !shouldRefreshCullingViewport(previous.viewport, next.viewport, true);
}
