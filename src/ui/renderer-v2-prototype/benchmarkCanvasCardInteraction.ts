export const BENCHMARK_CARD_DRAG_THRESHOLD = 6;
export const BENCHMARK_CARD_SLOT_TRANSITION_MS = 190;
export const BENCHMARK_CARD_AUTO_SCROLL_EDGE = 52;
export const BENCHMARK_CARD_AUTO_SCROLL_MAX = 16;

export function reorderCanvasCardsAtCenter(
  order: readonly number[],
  draggedId: number,
  centerY: number,
  previousCenterY: number,
  listTop: number,
  scrollTop: number,
  slotSize: number,
) {
  const fromIndex = order.indexOf(draggedId);
  if (fromIndex < 0 || centerY === previousCenterY) return order;

  const direction = centerY > previousCenterY ? 1 : -1;
  const neighborIndex = fromIndex + direction;
  if (neighborIndex < 0 || neighborIndex >= order.length) return order;

  const neighborMidpoint = listTop + neighborIndex * slotSize - scrollTop + slotSize / 2;
  if (direction > 0 ? centerY < neighborMidpoint : centerY > neighborMidpoint) return order;

  const next = [...order];
  const [dragged] = next.splice(fromIndex, 1);
  next.splice(neighborIndex, 0, dragged);
  return next;
}

export function calculateCanvasCardAutoScroll(
  pointerY: number,
  listTop: number,
  listBottom: number,
) {
  if (pointerY < listTop + BENCHMARK_CARD_AUTO_SCROLL_EDGE) {
    const proximity = 1 - Math.max(0, pointerY - listTop) / BENCHMARK_CARD_AUTO_SCROLL_EDGE;
    return -BENCHMARK_CARD_AUTO_SCROLL_MAX * proximity * proximity;
  }
  if (pointerY > listBottom - BENCHMARK_CARD_AUTO_SCROLL_EDGE) {
    const proximity = 1 - Math.max(0, listBottom - pointerY) / BENCHMARK_CARD_AUTO_SCROLL_EDGE;
    return BENCHMARK_CARD_AUTO_SCROLL_MAX * proximity * proximity;
  }
  return 0;
}

export function reorderThroughCrossedCanvasCardSlots(
  order: readonly number[],
  draggedId: number,
  centerY: number,
  previousCenterY: number,
  listTop: number,
  scrollTop: number,
  slotSize: number,
) {
  const direction = Math.sign(centerY - previousCenterY);
  if (direction === 0) return order;
  let next = order;
  while (true) {
    const candidate = reorderCanvasCardsAtCenter(
      next,
      draggedId,
      centerY,
      centerY - direction,
      listTop,
      scrollTop,
      slotSize,
    );
    if (candidate === next) return next;
    next = candidate;
  }
}

export function haveSameCanvasCardIds(left: readonly number[], right: readonly number[]) {
  return left.length === right.length && left.every((id) => right.includes(id));
}
