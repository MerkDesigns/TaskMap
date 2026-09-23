import type { RetainedCanvasView } from "../../app/view-projection/retainedCanvasProjectionTypes";
import type { InteractionElement } from "../../app/interactions/canvasInteractionTypes";
import type { ElementGeometry } from "../../canvas/geometry/canvasGeometry";
import {
  getLegacyInteractionElements,
  filterLegacyResizeSnapTargets,
  LEGACY_TEXT_CARD_ROW_HEIGHT,
  type LegacyResizeKind,
} from "./legacyCanvasGeometry";
import {
  getLegacyTextCardDragIds,
  getLegacyTextCardFinalPosition,
} from "./legacyTextCardPlacement";

// Unmounted compatibility boundary. Reuse retained geometry/placement calculations rather than
// derive a second layout from canonical storage rectangles. Construct at gesture setup, never pan.
export function createRetainedInteractionGeometry(
  canvas: RetainedCanvasView,
  measuredCardSizes: ReadonlyMap<string, { width: number; height: number }> = new Map(),
  scrollOffsets: Readonly<Record<string, number>> = {},
  visibleIds: ReadonlySet<string> = new Set(
    [...canvas.containers, ...canvas.textBlocks].map((item) => item.id),
  ),
) {
  const roots = getLegacyInteractionElements(canvas, measuredCardSizes);
  const byId = new Map(roots.map((item) => [item.id, item]));
  const cards = new Map(canvas.textCards.map((card) => [card.id, card]));
  const containerIds = new Set(canvas.containers.map((item) => item.id));
  const textBlockIds = new Set(canvas.textBlocks.map((item) => item.id));
  const snapTargets = roots.filter(
    (item) => (!containerIds.has(item.id) && !textBlockIds.has(item.id)) || visibleIds.has(item.id),
  );
  function gestureElement(id: string, includeContainedCard = false): InteractionElement | null {
    const root = byId.get(id);
    if (root) return root;
    const card = cards.get(id);
    if (!card || !includeContainedCard) return null;
    const position = getLegacyTextCardFinalPosition(canvas, card, scrollOffsets);
    const size = measuredCardSizes.get(id);
    return {
      id,
      geometry: {
        ...position,
        width: size?.width ?? LEGACY_TEXT_CARD_ROW_HEIGHT * 5,
        height: size?.height ?? LEGACY_TEXT_CARD_ROW_HEIGHT,
      },
      locked: card.extensions?.lock?.enabled ?? false,
      movable: true,
      resizable: false,
      centerSnapping: card.kind === "mindmap",
    };
  }
  return {
    roots,
    gestureElement,
    snapTargets,
    prepareMove(
      primaryId: string,
      selectedIds: readonly string[],
      primaryGeometry?: ElementGeometry,
    ) {
      const card = cards.get(primaryId);
      const genericGroup =
        !card?.containerId && selectedIds.length > 1 && selectedIds.includes(primaryId);
      const cardGesture = !!card && !genericGroup;
      const ids = cardGesture
        ? getLegacyTextCardDragIds(canvas.textCards, primaryId, selectedIds)
        : selectedIds.includes(primaryId)
          ? selectedIds
          : [primaryId];
      const targets = ids.flatMap((id) => {
        const target = gestureElement(id, cardGesture);
        return target
          ? [
              {
                ...target,
                geometry: id === primaryId && primaryGeometry ? primaryGeometry : target.geometry,
              },
            ]
          : [];
      });
      return {
        primaryId,
        targets,
        snapTargets,
        completionBehavior:
          cardGesture && card.kind !== "mindmap" ? ("place" as const) : ("translate" as const),
        commitThresholdScreen: cardGesture ? 3 : 0,
        // Selection/focus/pointer capture remain the view's responsibility, as in the current app.
        selectionAfterStart: cardGesture
          ? ids.length > 1
            ? ids
            : []
          : selectedIds.includes(primaryId)
            ? selectedIds
            : [primaryId],
      };
    },
    resizeSnapTargets(activeId: string, activeKind: LegacyResizeKind) {
      return filterLegacyResizeSnapTargets(roots, {
        activeId,
        activeKind,
        containerIds,
        textBlockIds,
        visibleIds,
      });
    },
  };
}
