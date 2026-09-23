import { useMemo, useSyncExternalStore, type ReactNode } from "react";
import type { CanvasInteractionController } from "../../app/interactions/canvasInteractionTypes";
import {
  getVisibleElementIds,
  shouldRefreshCullingViewport,
  type CullableElement,
} from "../../canvas/virtualization/viewportCulling";

/** Local culling subscription: camera movement never invalidates App or static chrome. */
export function LegacyCanvasVisibility({
  controller,
  elements,
  pinnedIds,
  children,
}: {
  readonly controller: CanvasInteractionController;
  readonly elements: readonly CullableElement[];
  readonly pinnedIds: ReadonlySet<string>;
  readonly children: (visibleIds: ReadonlySet<string>) => ReactNode;
}) {
  const getSnapshot = useMemo(() => {
    let viewport = controller.getSnapshot().viewport;
    let visible = getVisibleElementIds({ viewport, elements, pinnedIds });
    return () => {
      const next = controller.getSnapshot();
      if (
        shouldRefreshCullingViewport(
          viewport,
          next.viewport,
          next.activeInteraction?.kind === "pan",
        )
      ) {
        viewport = next.viewport;
        const updated = getVisibleElementIds({ viewport, elements, pinnedIds });
        if (updated.size !== visible.size || [...updated].some((id) => !visible.has(id))) {
          visible = updated;
        }
      }
      return visible;
    };
  }, [controller, elements, pinnedIds]);
  return children(useSyncExternalStore(controller.subscribe, getSnapshot, getSnapshot));
}
