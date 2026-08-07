import type { ContainerElement, TaskCanvas, TextCardElement } from "../../types";
import type { LegacyTextCardPlacementDecision } from "./legacyTextCardInteraction";

const HEADER_HEIGHT = 48;
const SEARCH_HEIGHT = 42;
const CARD_PADDING = 17;
const CARD_HEIGHT = 43;
const CARD_GAP = 8;

export function placeLegacyTextCardBundle(
  canvas: TaskCanvas,
  cards: TextCardElement[],
  targets: ReadonlyMap<string, { x: number; y: number }>,
  pointer: { x: number; y: number },
  scrollOffset: (containerId: string) => number,
  placement?: LegacyTextCardPlacementDecision | null,
): TextCardElement[] {
  if (placement) return applyPlacementDecision(cards, placement);
  const blockedByTextBlock = [...canvas.textBlocks]
    .reverse()
    .some(
      (block) =>
        pointer.x >= block.x &&
        pointer.x <= block.x + block.width &&
        pointer.y >= block.y &&
        pointer.y <= block.y + block.height,
    );
  const targetContainer = blockedByTextBlock
    ? undefined
    : [...canvas.containers]
        .reverse()
        .find(
          (container) =>
            pointer.x >= container.x &&
            pointer.x <= container.x + container.width &&
            pointer.y >= stackTop(container) - CARD_PADDING &&
            pointer.y <= container.y + container.height,
        );
  const movingIds = new Set(targets.keys());
  if (!targetContainer) {
    return normalizeOrders(
      cards.map((card) =>
        movingIds.has(card.id) ? { ...card, containerId: undefined, order: undefined } : card,
      ),
    );
  }

  const remaining = cards.filter((card) => !movingIds.has(card.id));
  const moving = cards.filter((card) => movingIds.has(card.id));
  const visible = visibleCards(targetContainer, remaining);
  const visibleIndex = insertionIndex(
    visible,
    pointer.y,
    stackTop(targetContainer) - scrollOffset(targetContainer.id),
  );
  const realIndex = resolveRealIndex(targetContainer, remaining, visible, visibleIndex);
  const siblings = remaining
    .filter((card) => card.containerId === targetContainer.id)
    .sort((left, right) => (left.order ?? 0) - (right.order ?? 0));
  siblings.splice(
    realIndex,
    0,
    ...moving.map((card) => ({ ...card, containerId: targetContainer.id })),
  );
  return normalizeOrders([
    ...remaining.filter((card) => card.containerId !== targetContainer.id),
    ...siblings.map((card, index) => ({ ...card, order: index })),
  ]);
}

function applyPlacementDecision(
  cards: TextCardElement[],
  placement: LegacyTextCardPlacementDecision,
): TextCardElement[] {
  const movingIds = new Set(placement.draggedIds);
  const positions = new Map(placement.loosePositions.map((position) => [position.id, position]));
  const positioned = cards.map((card) => {
    const position = positions.get(card.id);
    return position ? { ...card, x: position.x, y: position.y } : card;
  });
  if (!placement.targetContainerId) {
    return normalizeOrders(
      positioned.map((card) =>
        movingIds.has(card.id) ? { ...card, containerId: undefined, order: undefined } : card,
      ),
    );
  }

  const remaining = positioned.filter((card) => !movingIds.has(card.id));
  const moving = placement.draggedIds.flatMap((id) => {
    const card = positioned.find((candidate) => candidate.id === id);
    return card ? [card] : [];
  });
  const siblings = remaining
    .filter((card) => card.containerId === placement.targetContainerId)
    .sort((left, right) => (left.order ?? 0) - (right.order ?? 0));
  siblings.splice(
    Math.max(0, Math.min(placement.realIndex ?? siblings.length, siblings.length)),
    0,
    ...moving.map((card) => ({ ...card, containerId: placement.targetContainerId ?? undefined })),
  );
  return normalizeOrders([
    ...remaining.filter((card) => card.containerId !== placement.targetContainerId),
    ...siblings.map((card, index) => ({ ...card, order: index })),
  ]);
}

function stackTop(container: ContainerElement): number {
  return (
    container.y + HEADER_HEIGHT + (container.extensions?.search ? SEARCH_HEIGHT : 0) + CARD_PADDING
  );
}

function insertionIndex(cards: readonly TextCardElement[], pointerY: number, top: number): number {
  for (let index = 0; index < cards.length; index += 1) {
    if (pointerY < top + index * (CARD_HEIGHT + CARD_GAP) + CARD_HEIGHT / 2) return index;
  }
  return cards.length;
}

function visibleCards(
  container: ContainerElement,
  cards: readonly TextCardElement[],
): TextCardElement[] {
  const ordered = cards
    .filter((card) => card.containerId === container.id)
    .sort((left, right) => (left.order ?? 0) - (right.order ?? 0));
  const query = container.extensions?.search?.query.trim().toLowerCase() ?? "";
  const searched = query
    ? ordered.filter((card) => card.text.toLowerCase().includes(query))
    : ordered;
  const selectedId = container.extensions?.pickCard?.selectedCardId;
  const filtered = selectedId ? searched.filter((card) => card.id === selectedId) : searched;
  const sorting = container.extensions?.sorting;
  if (!sorting?.mode) return filtered;
  return [...filtered].sort((left, right) => {
    const value = (card: TextCardElement) =>
      sorting.mode === "alphabet"
        ? card.text.replace(/[*_]/g, "").trim().toLocaleLowerCase()
        : card.accent.toLocaleLowerCase();
    const leftValue = value(left);
    const rightValue = value(right);
    const group = (item: string) => (/^[a-z]/i.test(item) ? 0 : 1);
    const groupDifference = sorting.mode === "alphabet" ? group(leftValue) - group(rightValue) : 0;
    const stableDifference = (left.order ?? 0) - (right.order ?? 0);
    const direction = sorting.direction === "asc" ? 1 : -1;
    return groupDifference || (leftValue.localeCompare(rightValue) || stableDifference) * direction;
  });
}

function resolveRealIndex(
  container: ContainerElement,
  cards: readonly TextCardElement[],
  visible: readonly TextCardElement[],
  visibleIndex: number,
): number {
  const ordered = cards
    .filter((card) => card.containerId === container.id)
    .sort((left, right) => (left.order ?? 0) - (right.order ?? 0));
  if (visible.length === 0) return ordered.length;
  if (visibleIndex >= visible.length) {
    return ordered.findIndex((card) => card.id === visible[visible.length - 1].id) + 1;
  }
  return ordered.findIndex((card) => card.id === visible[Math.max(visibleIndex, 0)].id);
}

function normalizeOrders(cards: TextCardElement[]): TextCardElement[] {
  const next = [...cards];
  const containerIds = new Set(
    next.flatMap((card) => (card.containerId ? [card.containerId] : [])),
  );
  containerIds.forEach((containerId) => {
    next
      .filter((card) => card.containerId === containerId)
      .sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
      .forEach((card, index) => {
        const position = next.findIndex(({ id }) => id === card.id);
        next[position] = { ...card, order: index };
      });
  });
  return next;
}
