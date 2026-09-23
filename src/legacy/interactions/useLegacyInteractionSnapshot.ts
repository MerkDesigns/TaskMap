import { useMemo, useSyncExternalStore } from "react";
import type { CanvasInteractionController } from "../../app/interactions/canvasInteractionTypes";

/** Camera frames have their own DOM presentation subscription, outside the legacy App tree. */
export function useLegacyInteractionSnapshot(controller: CanvasInteractionController) {
  const getSnapshot = useMemo(() => {
    let previous = controller.getSnapshot();
    return () => {
      const next = controller.getSnapshot();
      if (
        next.canvasKey !== previous.canvasKey ||
        next.activeInteraction !== previous.activeInteraction ||
        next.selectedIds !== previous.selectedIds ||
        next.selectionPreviewIds !== previous.selectionPreviewIds ||
        next.selectionRectangle !== previous.selectionRectangle ||
        next.geometryPreviews !== previous.geometryPreviews ||
        next.snapGuides !== previous.snapGuides
      ) {
        previous = next;
      }
      return previous;
    };
  }, [controller]);
  return useSyncExternalStore(controller.subscribe, getSnapshot, getSnapshot);
}
