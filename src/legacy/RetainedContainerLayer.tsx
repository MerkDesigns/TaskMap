import { useRef } from "react";
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
  containerCardStackTop,
  containerViewportHeight,
} from "./containerCardLayout";
import type {
  LegacyTextCardPresentation,
  LegacyTextCardRelease,
} from "./interactions/legacyTextCardInteraction";
import { useRetainedDocumentElements } from "./RetainedCanvasContext";
import {
  editDraft,
  isMultiSelected,
  type LayerProps,
  type RetainedElementPresentation,
} from "./retainedElementPresentation";
import type { useContainerCardScroll } from "./useContainerCardScroll";

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

/** A token that changes exactly when one of `dependencies` changes identity. */
function useRevisionToken(dependencies: readonly unknown[]): object {
  const revision = useRef<{ dependencies: readonly unknown[]; token: object } | null>(null);
  const previous = revision.current;
  if (
    !previous ||
    previous.dependencies.length !== dependencies.length ||
    dependencies.some((dependency, index) => !Object.is(dependency, previous.dependencies[index]))
  )
    revision.current = { dependencies, token: {} };
  return revision.current!.token;
}

export interface ContainerLayerLayoutInput {
  readonly cardScroll: ReturnType<typeof useContainerCardScroll>;
  readonly textCards: readonly TextCardElement[];
  readonly presentation: RetainedElementPresentation;
  readonly interactionKind: string | undefined;
  readonly draggedCardIds: readonly string[];
  readonly heldCards: LegacyTextCardPresentation | null;
  readonly cardRelease: LegacyTextCardRelease | null;
  readonly releasingCardIds: readonly string[];
  /** The container of the card being edited, if any. */
  readonly editingCardContainerId: string | undefined;
}

/** The card rows the container layer draws, and when they need redrawing. */
export function useContainerLayerLayout({
  cardScroll,
  textCards,
  presentation,
  interactionKind,
  draggedCardIds,
  heldCards,
  cardRelease,
  releasingCardIds,
  editingCardContainerId,
}: ContainerLayerLayoutInput): ContainerCardLayout {
  const { layout } = cardScroll;
  const edit = presentation.textCardEdit;
  const contentRevision = useRevisionToken([
    cardScroll.offsets,
    presentation.deleting.textCards,
    draggedCardIds,
    interactionKind,
    heldCards,
    cardRelease,
    presentation.entering.textCards,
    presentation.outlinedIds,
    presentation.pulsing.textCards,
    presentation.selectedIds.length,
    textCards,
  ]);
  return {
    cardsOf: (container) =>
      (cardScroll.grouped.get(container.id) ?? []).filter(
        (card) => !draggedCardIds.includes(card.id),
      ),
    visibleCards: (container, cards) => layout.visible(container, [...cards]),
    scrollOffset: layout.scrollOffset,
    viewportHeight: containerViewportHeight,
    stackTop: containerCardStackTop,
    insertion: {
      containerId: heldCards?.targetContainerId ?? null,
      index: heldCards?.insertionIndex ?? null,
      count: heldCards?.ids.length ?? 0,
    },
    releasingIds: releasingCardIds,
    contentRevision,
    contentEditRevision: (containerId) =>
      editingCardContainerId === containerId ? `${edit.id}\u0000${edit.draft}` : "",
  };
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
                  // Rows never overlap, so a card's canvas layer means nothing here; it would
                  // only lift a high-layer card over the container header when scrolled.
                  layer: 0,
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
