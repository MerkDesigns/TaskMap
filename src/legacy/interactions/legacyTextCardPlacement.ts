import type { ElementGeometry } from "../../canvas/geometry/canvasGeometry";
import type { ContainerElement, TaskCanvas, TextBlockElement, TextCardElement } from "../../types";

const HEADER_HEIGHT = 48;
const SEARCH_HEIGHT = 42;
const PADDING = 17;
export const LEGACY_TEXT_CARD_ROW_HEIGHT = 43;
const GAP = 8;

export interface LegacyTextCardPlacementDecision {
  readonly draggedIds: readonly string[];
  readonly targetContainerId: string | null;
  readonly visibleIndex: number | null;
  readonly realIndex: number | null;
  readonly loosePositions: readonly { id: string; x: number; y: number }[];
}

export interface LegacyTextCardPlacementState {
  readonly primaryId: string;
  readonly ids: readonly string[];
  readonly current: { x: number; y: number };
  readonly offsets: readonly { id: string; x: number; y: number }[];
  readonly startContainerId?: string;
  readonly targetContainerId: string | null;
  readonly insertionIndex: number | null;
  readonly cards: readonly TextCardElement[];
  readonly containers: readonly ContainerElement[];
  readonly textBlocks: readonly TextBlockElement[];
  readonly scrollOffsets: Readonly<Record<string, number>>;
  readonly pointerOffsetY: number;
  readonly lastCenterY: number;
}

export function getLegacyTextCardPreviewRowOffset(options: {
  readonly targetContainerId: string | null;
  readonly containerId: string;
  readonly insertionIndex: number | null;
  readonly visibleIndex: number;
  readonly insertionCount: number;
}): number {
  return options.targetContainerId === options.containerId &&
    options.insertionIndex !== null &&
    options.visibleIndex >= options.insertionIndex
    ? options.insertionCount
    : 0;
}

export function getLegacyTextCardDragIds(
  cards: readonly TextCardElement[],
  primaryId: string,
  selectedIds: readonly string[],
): string[] {
  const primary = cards.find(({ id }) => id === primaryId);
  if (!primary || primary.extensions?.lock?.enabled) return [];
  const bundle =
    primary.containerId && selectedIds.includes(primaryId)
      ? cards
          .filter(
            (card) => card.containerId === primary.containerId && selectedIds.includes(card.id),
          )
          .sort(order)
      : [primary];
  return bundle.filter((card) => !card.extensions?.lock?.enabled).map(({ id }) => id);
}

export function resolveLegacyTextCardPlacement(
  state: LegacyTextCardPlacementState,
  world: { x: number; y: number },
  geometry: ElementGeometry,
): {
  targetContainerId: string | null;
  insertionIndex: number | null;
  dropPreview: ElementGeometry | null;
  centerY: number;
} {
  const target =
    cardKind(state.cards, state.primaryId) === "mindmap" ? null : dropContainer(state, world);
  const centerY = world.y - state.pointerOffsetY + LEGACY_TEXT_CARD_ROW_HEIGHT / 2;
  const withoutBundle = state.cards.filter((card) => !state.ids.includes(card.id));
  let index: number | null = null;
  if (target) {
    if (state.targetContainerId === target.id && state.insertionIndex !== null) {
      index = directionalIndex(state, target, withoutBundle, centerY);
    } else {
      const original =
        target.id === state.startContainerId
          ? visibleCards(target, state.cards).findIndex(({ id }) => id === state.primaryId)
          : undefined;
      index = insertionIndex(
        target,
        withoutBundle,
        centerY,
        state.scrollOffsets[target.id] ?? 0,
        original,
      );
    }
  }
  return {
    targetContainerId: target?.id ?? null,
    insertionIndex: index,
    dropPreview: target && index !== null ? previewGeometry(target, index, state, geometry) : null,
    centerY,
  };
}

export function getLegacyTextCardPlacementDecision(
  state: LegacyTextCardPlacementState,
): LegacyTextCardPlacementDecision {
  const target = state.targetContainerId
    ? state.containers.find(({ id }) => id === state.targetContainerId)
    : undefined;
  const cards = state.cards.filter((card) => !state.ids.includes(card.id));
  const visibleIndex = target ? (state.insertionIndex ?? 0) : null;
  return {
    draggedIds: state.ids,
    targetContainerId: target?.id ?? null,
    visibleIndex,
    realIndex: target ? realInsertionIndex(target, cards, visibleIndex ?? 0) : null,
    loosePositions: state.offsets.map((offset) => ({
      id: offset.id,
      x: state.current.x + offset.x,
      y: state.current.y + offset.y,
    })),
  };
}

export function getLegacyTextCardFinalPosition(
  canvas: TaskCanvas,
  card: TextCardElement,
  scroll: Readonly<Record<string, number>>,
): { x: number; y: number } {
  const container = card.containerId
    ? canvas.containers.find(({ id }) => id === card.containerId)
    : undefined;
  if (!container) return { x: card.x, y: card.y };
  const index = Math.max(
    visibleCards(container, canvas.textCards).findIndex(({ id }) => id === card.id),
    0,
  );
  return {
    x: container.x + PADDING,
    y:
      stackTop(container) +
      index * (LEGACY_TEXT_CARD_ROW_HEIGHT + GAP) -
      (scroll[container.id] ?? 0),
  };
}

function dropContainer(
  state: LegacyTextCardPlacementState,
  point: { x: number; y: number },
): ContainerElement | null {
  if ([...state.textBlocks].reverse().some((item) => inside(point, item))) return null;
  return (
    [...state.containers]
      .reverse()
      .find(
        (container) =>
          point.x >= container.x &&
          point.x <= container.x + container.width &&
          point.y >= stackTop(container) - PADDING &&
          point.y <= container.y + container.height,
      ) ?? null
  );
}

function directionalIndex(
  state: LegacyTextCardPlacementState,
  container: ContainerElement,
  cards: readonly TextCardElement[],
  centerY: number,
): number {
  const current = state.insertionIndex ?? 0;
  const visible = visibleCards(container, cards);
  const top = stackTop(container) - (state.scrollOffsets[container.id] ?? 0);
  const slot = LEGACY_TEXT_CARD_ROW_HEIGHT + GAP;
  if (
    centerY > state.lastCenterY + 0.5 &&
    current < visible.length &&
    centerY > top + (current + 1) * slot + LEGACY_TEXT_CARD_ROW_HEIGHT / 2
  )
    return current + 1;
  if (
    centerY < state.lastCenterY - 0.5 &&
    current > 0 &&
    centerY < top + (current - 1) * slot + LEGACY_TEXT_CARD_ROW_HEIGHT / 2
  )
    return current - 1;
  return current;
}

function insertionIndex(
  container: ContainerElement,
  cards: readonly TextCardElement[],
  centerY: number,
  scroll: number,
  current?: number,
): number {
  const visible = visibleCards(container, cards);
  const top = stackTop(container) - scroll;
  if (current !== undefined && current >= 0) {
    if (
      current > 0 &&
      centerY <
        top + (current - 1) * (LEGACY_TEXT_CARD_ROW_HEIGHT + GAP) + LEGACY_TEXT_CARD_ROW_HEIGHT / 2
    )
      return current - 1;
    if (
      current < visible.length &&
      centerY >
        top + (current + 1) * (LEGACY_TEXT_CARD_ROW_HEIGHT + GAP) + LEGACY_TEXT_CARD_ROW_HEIGHT / 2
    )
      return current + 1;
    return current;
  }
  const index = visible.findIndex(
    (_, position) =>
      centerY <
      top + position * (LEGACY_TEXT_CARD_ROW_HEIGHT + GAP) + LEGACY_TEXT_CARD_ROW_HEIGHT / 2,
  );
  return index < 0 ? visible.length : index;
}

function realInsertionIndex(
  container: ContainerElement,
  cards: readonly TextCardElement[],
  visibleIndex: number,
): number {
  const full = cards.filter((card) => card.containerId === container.id).sort(order);
  const visible = visibleCards(container, cards);
  if (!visible.length) return full.length;
  if (visibleIndex >= visible.length) {
    return full.findIndex(({ id }) => id === visible[visible.length - 1].id) + 1;
  }
  return full.findIndex(({ id }) => id === visible[Math.max(visibleIndex, 0)].id);
}

function visibleCards(
  container: ContainerElement,
  cards: readonly TextCardElement[],
): TextCardElement[] {
  const ordered = cards.filter((card) => card.containerId === container.id).sort(order);
  const query = container.extensions?.search?.query.trim().toLowerCase() ?? "";
  const searched = query
    ? ordered.filter((card) => card.text.toLowerCase().includes(query))
    : ordered;
  const picked = container.extensions?.pickCard?.selectedCardId;
  const filtered = picked ? searched.filter(({ id }) => id === picked) : searched;
  const sorting = container.extensions?.sorting;
  if (!sorting?.mode) return filtered;
  return [...filtered].sort((left, right) => {
    const key = (card: TextCardElement) =>
      sorting.mode === "alphabet"
        ? card.text.replace(/[*_]/g, "").trim().toLocaleLowerCase()
        : card.accent.toLocaleLowerCase();
    const leftKey = key(left);
    const rightKey = key(right);
    const group = (value: string) => (/^[a-z]/i.test(value) ? 0 : 1);
    const groupDifference = sorting.mode === "alphabet" ? group(leftKey) - group(rightKey) : 0;
    const difference = leftKey.localeCompare(rightKey) || order(left, right);
    return groupDifference || difference * (sorting.direction === "asc" ? 1 : -1);
  });
}

function previewGeometry(
  container: ContainerElement,
  index: number,
  state: LegacyTextCardPlacementState,
  geometry: ElementGeometry,
): ElementGeometry {
  return {
    x: container.x + PADDING,
    y:
      stackTop(container) +
      index * (LEGACY_TEXT_CARD_ROW_HEIGHT + GAP) -
      (state.scrollOffsets[container.id] ?? 0),
    width: Math.min(geometry.width, container.width - PADDING * 2),
    height: geometry.height,
  };
}

const stackTop = (container: ContainerElement) =>
  container.y + HEADER_HEIGHT + (container.extensions?.search ? SEARCH_HEIGHT : 0) + PADDING;
const order = (left: TextCardElement, right: TextCardElement) =>
  (left.order ?? 0) - (right.order ?? 0);
const cardKind = (cards: readonly TextCardElement[], id: string) =>
  cards.find((card) => card.id === id)?.kind;
const inside = (
  point: { x: number; y: number },
  item: { x: number; y: number; width: number; height: number },
) =>
  point.x >= item.x &&
  point.x <= item.x + item.width &&
  point.y >= item.y &&
  point.y <= item.y + item.height;
