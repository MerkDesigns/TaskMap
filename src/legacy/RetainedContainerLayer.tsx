import { getVirtualRowRange, isVirtualRowInRange } from "../canvasMath";
import type { ElementId } from "../domain/ids/entityIds";
import { ContainerRenderer } from "../elements/container/ContainerRenderer";
import type { ContainerActions } from "../elements/container/containerView";
import { asContainerDocumentElement } from "../elements/container/containerViewProjection";
import { TextCardRenderer, type TextCardActions } from "../elements/text-card/TextCardRenderer";
import { asTextCardRendererElement } from "../elements/text-card/textCardViewProjection";
import { hasContentState } from "../extensions/contentState";
import type { ExtensionCommands } from "../extensions/extensionCommands";
import type { ContainerElement, TextCardElement } from "../types";
import { getLegacyTextCardPreviewRowOffset } from "./interactions/legacyTextCardPlacement";
import {
  CONTAINER_TEXT_CARD_GAP,
  CONTAINER_TEXT_CARD_PADDING,
  CONTAINER_TEXT_CARD_ROW_HEIGHT,
} from "./containerCardLayout";
import { useRetainedDocumentElements } from "./RetainedCanvasContext";
import { editDraft, isMultiSelected, type LayerProps } from "./retainedElementPresentation";

const CONTAINER_TEXT_CARD_OVERSCAN_ROWS = 3;
const ROW_PITCH = CONTAINER_TEXT_CARD_ROW_HEIGHT + CONTAINER_TEXT_CARD_GAP;

/** Where the cards of each container are, as the container's card rows show them. */
export interface ContainerCardLayout {
  /** The container's cards in order, without the ones being dragged out of it. */
  readonly cardsOf: (container: ContainerElement) => readonly TextCardElement[];
  /** The cards that match the container's search, in their visible rows. */
  readonly visibleCards: (
    container: ContainerElement,
    cards: readonly TextCardElement[],
  ) => readonly TextCardElement[];
  readonly scrollOffset: (container: ContainerElement) => number;
  readonly viewportHeight: (container: ContainerElement) => number;
  /** Canvas y of the first card row. */
  readonly stackTop: (container: ContainerElement) => number;
  /** Cards being dragged over a container open a gap of this many rows at `index`. */
  readonly insertion: {
    readonly containerId: string | null;
    readonly index: number | null;
    readonly count: number;
  };
  /** Cards flying back after a drop; they are drawn in the release overlay instead. */
  readonly releasingIds: readonly string[];
  /** Changes whenever the cards a container draws may have changed. */
  readonly contentRevision: object;
  /** The edit in progress on one of this container's cards, so the container redraws it. */
  readonly contentEditRevision: (containerId: string) => string;
}

export function ContainerLayer({
  elements,
  visibleIds,
  presentation,
  layout,
  actions,
  cardActions,
  extensionCommands,
}: LayerProps<ContainerElement> & {
  readonly layout: ContainerCardLayout;
  readonly actions: ContainerActions;
  readonly cardActions: TextCardActions;
  readonly extensionCommands: ExtensionCommands;
}) {
  const documentElements = useRetainedDocumentElements();
  const { entering, deleting, pulsing, textCardEdit, draggedIds } = presentation;
  return elements
    .filter((element) => visibleIds.has(element.id))
    .map((element) => {
      const containerElement = asContainerDocumentElement(
        documentElements[element.id as ElementId],
      );
      if (!containerElement) return null;
      // A settling card stays in this list so its neighbours keep their slots; it is drawn in the
      // release overlay and skipped below. Dropping it here would shift every later card up a row
      // for the settle, which reads as a brief shuffle.
      const allCards = layout.cardsOf(element);
      const cards = layout.visibleCards(element, allCards);
      const insertionCount =
        layout.insertion.containerId === element.id ? layout.insertion.count : 0;
      const scrollOffset = layout.scrollOffset(element);
      const renderRange = getVirtualRowRange({
        rowCount: cards.length + insertionCount,
        rowHeight: CONTAINER_TEXT_CARD_ROW_HEIGHT,
        rowGap: CONTAINER_TEXT_CARD_GAP,
        padding: CONTAINER_TEXT_CARD_PADDING,
        scrollOffset,
        viewportHeight: layout.viewportHeight(element),
        overscanRows: CONTAINER_TEXT_CARD_OVERSCAN_ROWS,
      });
      const multiSelected = isMultiSelected(presentation, element.id);
      const stackTop = layout.stackTop(element);

      return (
        <ContainerRenderer
          key={element.id}
          element={containerElement}
          actions={actions}
          extensionCommands={extensionCommands}
          view={{
            layer: element.layer ?? 0,
            geometry: { x: element.x, y: element.y, width: element.width, height: element.height },
            extensions: element.extensions,
            cardCount: allCards.length,
            selected: presentation.outlinedIds.includes(element.id),
            multiSelected,
            entering: entering.containers.includes(element.id),
            deleting: deleting.containers.includes(element.id),
            moving: draggedIds.includes(element.id),
            shadowsUnderElements: presentation.shadowsUnderElements,
            recentColors: presentation.recentColors,
            renaming: presentation.rename.id === element.id,
            renameDraft: editDraft(presentation.rename, element.id),
            contentRevision: layout.contentRevision,
            contentEditRevision: layout.contentEditRevision(element.id),
          }}
        >
          {cards.map((card, visibleIndex) => {
            if (layout.releasingIds.includes(card.id)) return null;
            const previewRowOffset = getLegacyTextCardPreviewRowOffset({
              targetContainerId: layout.insertion.containerId,
              containerId: element.id,
              insertionIndex: layout.insertion.index,
              visibleIndex,
              insertionCount,
            });
            const animationPinned =
              textCardEdit.id === card.id ||
              entering.textCards.includes(card.id) ||
              deleting.textCards.includes(card.id) ||
              pulsing.textCards.includes(card.id);
            if (
              !animationPinned &&
              !isVirtualRowInRange(visibleIndex, renderRange, previewRowOffset)
            ) {
              return null;
            }
            const cardElement = asTextCardRendererElement(documentElements[card.id as ElementId]);
            if (!cardElement) return null;
            const dragged = draggedIds.includes(card.id);
            return (
              <TextCardRenderer
                key={card.id}
                element={cardElement}
                actions={cardActions}
                extensionCommands={extensionCommands}
                view={{
                  layer: card.layer ?? 0,
                  extensions: card.extensions,
                  editing: textCardEdit.id === card.id,
                  draft: editDraft(textCardEdit, card.id),
                  // Relative to the container, which places its card list.
                  position: {
                    x: CONTAINER_TEXT_CARD_PADDING,
                    y:
                      stackTop -
                      element.y +
                      (visibleIndex + previewRowOffset) * ROW_PITCH -
                      scrollOffset,
                    maxWidth: Math.max(120, element.width - CONTAINER_TEXT_CARD_PADDING * 2),
                  },
                  entering: entering.textCards.includes(card.id),
                  deleting: deleting.textCards.includes(card.id),
                  pulsing: pulsing.textCards.includes(card.id),
                  motion: dragged ? "moving" : undefined,
                  selected: presentation.outlinedIds.includes(card.id),
                  interaction: multiSelected ? "disabled" : undefined,
                  linksDisabled: presentation.selectedIds.length > 1,
                  contentHidden: hasContentState(element.extensions, "hidden"),
                  // The shared under-element shadow layer sits below containers, so contained
                  // cards keep their own shadow; only dragged cards are drawn on that layer.
                  shadowsUnderElements: presentation.shadowsUnderElements && dragged,
                }}
              />
            );
          })}
        </ContainerRenderer>
      );
    });
}
