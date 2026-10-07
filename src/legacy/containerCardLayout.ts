import { clamp } from "../canvasMath";
import { cardsMatchingSearch, searchRowHeight } from "../extensions/search/searchRule";
import type { ContainerElement, TextCardElement } from "../types";

/** Cards inside a container sit in fixed rows below its header (and search row). */
export const CONTAINER_HEADER_HEIGHT = 48;
export const CONTAINER_TEXT_CARD_PADDING = 17;
export const CONTAINER_TEXT_CARD_ROW_HEIGHT = 43;
export const CONTAINER_TEXT_CARD_GAP = 8;
const ROW_PITCH = CONTAINER_TEXT_CARD_ROW_HEIGHT + CONTAINER_TEXT_CARD_GAP;

type Point = { readonly x: number; readonly y: number };
type Cards = readonly TextCardElement[];

/** Every container's cards in their stored order. */
export function groupContainerCards(cards: Cards): ReadonlyMap<string, TextCardElement[]> {
  const grouped = new Map<string, TextCardElement[]>();
  for (const card of cards) {
    if (!card.containerId) continue;
    const containerCards = grouped.get(card.containerId) ?? [];
    containerCards.push(card);
    grouped.set(card.containerId, containerCards);
  }
  grouped.forEach((containerCards) =>
    containerCards.sort((left, right) => (left.order ?? 0) - (right.order ?? 0)),
  );
  return grouped;
}

/** Canvas y where a container's first card row starts, before scrolling. */
export const containerCardStackTop = (container: ContainerElement) =>
  container.y + CONTAINER_HEADER_HEIGHT + searchRowHeight(container) + CONTAINER_TEXT_CARD_PADDING;

/** The height the card rows can show, below the header and search row. */
export const containerViewportHeight = (container: ContainerElement) =>
  Math.max(0, container.height - CONTAINER_HEADER_HEIGHT - searchRowHeight(container));

/** The height `count` card rows take, with padding above and below. */
export const containerContentHeight = (count: number) =>
  count === 0
    ? CONTAINER_TEXT_CARD_PADDING * 2
    : CONTAINER_TEXT_CARD_PADDING * 2 +
      count * CONTAINER_TEXT_CARD_ROW_HEIGHT +
      (count - 1) * CONTAINER_TEXT_CARD_GAP;

/**
 * The card rows of every container for one set of cards and scroll offsets: which cards a
 * container shows (matching its search), how far it may scroll, where each row sits on the canvas
 * and which row a dropped card lands in.
 */
export function createContainerCardLayout(
  allCards: Cards,
  grouped: ReadonlyMap<string, TextCardElement[]>,
  scrollOffsets: Readonly<Record<string, number>>,
) {
  /** A container's cards in order; `cards` replaces the current cards for a what-if layout. */
  const ordered = (containerId: string, cards: Cards = allCards): TextCardElement[] =>
    cards === allCards
      ? (grouped.get(containerId) ?? [])
      : cards
          .filter((card) => card.containerId === containerId)
          .sort((left, right) => (left.order ?? 0) - (right.order ?? 0));

  // A card's index in this list is the row it occupies on screen; drag math relies on it, so it
  // must filter exactly as rendering does (notably with the search extension).
  const visible = (container: ContainerElement, cards: Cards = allCards) =>
    cardsMatchingSearch(container, ordered(container.id, cards));

  const maxScroll = (container: ContainerElement, cards: Cards = allCards) =>
    Math.max(
      0,
      containerContentHeight(visible(container, cards).length) - containerViewportHeight(container),
    );

  const scrollOffset = (container: ContainerElement) =>
    clamp(scrollOffsets[container.id] ?? 0, 0, maxScroll(container));

  /** Canvas position of the row at `index`, as currently scrolled. */
  const rowPosition = (container: ContainerElement, index: number): Point => ({
    x: container.x + CONTAINER_TEXT_CARD_PADDING,
    y: containerCardStackTop(container) + index * ROW_PITCH - scrollOffset(container),
  });

  return {
    ordered,
    visible,
    maxScroll,
    scrollOffset,
    rowPosition,
    /** Where a contained card sits; unlisted cards take the first row. */
    cardPosition(container: ContainerElement, card: TextCardElement, cards: Cards = allCards) {
      const index = visible(container, cards).findIndex((other) => other.id === card.id);
      return rowPosition(container, Math.max(index, 0));
    },
    /** The scroll offset that brings the row at `visibleIndex` fully into view. */
    revealOffset(container: ContainerElement, visibleIndex: number, cards: Cards) {
      const current = scrollOffset(container);
      const viewport = containerViewportHeight(container);
      const limit = maxScroll(container, cards);
      const slotTop = CONTAINER_TEXT_CARD_PADDING + visibleIndex * ROW_PITCH;
      const slotBottom = slotTop + CONTAINER_TEXT_CARD_ROW_HEIGHT;
      if (slotBottom > current + viewport - CONTAINER_TEXT_CARD_PADDING)
        return clamp(slotBottom - viewport + CONTAINER_TEXT_CARD_PADDING, 0, limit);
      if (slotTop < current + CONTAINER_TEXT_CARD_PADDING)
        return clamp(slotTop - CONTAINER_TEXT_CARD_PADDING, 0, limit);
      return current;
    },
    /**
     * The row a card dropped at `point` lands in, counted among the shown cards without the
     * dragged one. With `currentIndex` the drop moves at most one row from there, past a
     * neighbour's midpoint.
     */
    dropIndex(
      container: ContainerElement,
      point: Point,
      cards: Cards,
      draggingId: string,
      currentIndex?: number,
    ) {
      const shown = visible(container, cards).filter((card) => card.id !== draggingId);
      const top = containerCardStackTop(container) - scrollOffset(container);
      const midpoint = (index: number) =>
        top + index * ROW_PITCH + CONTAINER_TEXT_CARD_ROW_HEIGHT / 2;
      if (currentIndex !== undefined) {
        if (shown[currentIndex - 1] && point.y < midpoint(currentIndex - 1))
          return currentIndex - 1;
        if (shown[currentIndex] && point.y > midpoint(currentIndex + 1)) return currentIndex + 1;
        return currentIndex;
      }
      const index = shown.findIndex((_, row) => point.y < midpoint(row));
      return index === -1 ? shown.length : index;
    },
  };
}

export type ContainerCardLayoutModel = ReturnType<typeof createContainerCardLayout>;
