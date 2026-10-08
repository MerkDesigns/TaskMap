import { useMemo } from "react";
import type { CanvasInteractionSnapshot } from "../app/interactions/canvasInteractionTypes";
import type { LegacyTextCardInteractionSnapshot } from "./interactions/legacyTextCardInteraction";
import type { RetainedElementPresentation } from "./retainedElementPresentation";
import type { ElementIdsByKind } from "./useElementPresenceMarks";
import type { RetainedInlineEdit } from "./useRetainedInlineEdit";

const NONE: readonly string[] = [];

export interface CanvasPresentationInput {
  readonly interaction: CanvasInteractionSnapshot;
  readonly cardDrags: LegacyTextCardInteractionSnapshot;
  readonly isCard: (id: string) => boolean;
  readonly rename: RetainedInlineEdit;
  readonly cardEdit: RetainedInlineEdit;
  readonly blockEdit: RetainedInlineEdit;
  readonly marks: {
    readonly entering: ElementIdsByKind;
    readonly deleting: ElementIdsByKind;
    readonly pulsing: Pick<ElementIdsByKind, "textCards" | "textBlocks">;
  };
  readonly shadowsUnderElements: boolean;
  readonly recentColors: readonly string[];
  readonly importingImageIds: readonly string[];
}

/**
 * What the canvas shows about its elements this render beyond the document: outlines, selection,
 * the elements a gesture moves, cards held or settling after a drag, edits in progress and
 * enter/delete/pulse marks, plus the elements culling must keep rendered.
 */
export function useCanvasPresentation({
  interaction,
  cardDrags,
  isCard,
  rename,
  cardEdit,
  blockEdit,
  marks,
  shadowsUnderElements,
  recentColors,
  importingImageIds,
}: CanvasPresentationInput) {
  const { activeInteraction, selectionRectangle } = interaction;
  const selectedIds = interaction.selectedIds as string[];
  const moving = activeInteraction?.kind === "move" ? activeInteraction : null;
  const draggedIds =
    activeInteraction?.kind === "move" || activeInteraction?.kind === "resize"
      ? activeInteraction.targetIds
      : NONE;
  const draggedCardIds = moving ? moving.targetIds.filter(isCard) : NONE;
  const heldCards = cardDrags.active;
  const releasingCardIds = cardDrags.release?.cards.map(({ card }) => card.id) ?? NONE;
  // A fresh empty list each render: the container layer's content revision follows its identity.
  const outlinedIds = selectionRectangle
    ? interaction.selectionPreviewIds
    : selectedIds.length > 1
      ? selectedIds
      : [];

  const renamingId = rename.editingId;
  const editingCardId = cardEdit.editingId;
  const editingBlockId = blockEdit.editingId;
  const pinnedIds = useMemo(() => {
    const ids = new Set(selectedIds);
    for (const id of [renamingId, editingBlockId, editingCardId]) if (id) ids.add(id);
    draggedIds.forEach((id) => ids.add(id));
    return ids;
  }, [draggedIds, editingBlockId, editingCardId, renamingId, selectedIds]);

  const presentation: RetainedElementPresentation = {
    outlinedIds,
    selectedIds,
    draggedIds,
    primaryMoveId: moving ? (moving.targetIds[0] ?? null) : null,
    shadowsUnderElements,
    recentColors,
    entering: marks.entering,
    deleting: marks.deleting,
    pulsing: marks.pulsing,
    textCardEdit: { id: editingCardId, draft: cardEdit.draft },
    textBlockEdit: { id: editingBlockId, draft: blockEdit.draft },
    rename: { id: renamingId, draft: rename.draft },
    importingImageIds,
  };

  return {
    presentation,
    pinnedIds,
    draggedCardIds,
    heldCards,
    releasingCardIds,
    /** Cards an overlay draws instead of their layer: held, or settling after a drop. */
    overlaidCardIds: [...(heldCards?.ids ?? []), ...releasingCardIds],
    selectionVisible: Boolean(selectionRectangle),
  };
}
