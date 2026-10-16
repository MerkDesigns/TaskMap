import { useMemo, useRef, useSyncExternalStore } from "react";
import type { CanvasInteractionController } from "../../app/interactions/canvasInteractionTypes";

/**
 * Camera frames have their own DOM presentation subscription, outside the legacy App tree.
 * `previewsDrawnElsewhere` is true while the moved elements are drawn by an overlay that follows
 * the pointer itself (held text cards): their geometry previews then do not re-render App.
 */
export function useLegacyInteractionSnapshot(
  controller: CanvasInteractionController,
  previewsDrawnElsewhere: () => boolean = () => false,
) {
  const previewsElsewhereRef = useRef(previewsDrawnElsewhere);
  previewsElsewhereRef.current = previewsDrawnElsewhere;
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
        (next.geometryPreviews !== previous.geometryPreviews && !previewsElsewhereRef.current()) ||
        next.snapGuides !== previous.snapGuides
      ) {
        previous = next;
      }
      return previous;
    };
  }, [controller]);
  return useSyncExternalStore(controller.subscribe, getSnapshot, getSnapshot);
}
