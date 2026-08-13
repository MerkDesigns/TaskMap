export const BENCHMARK_CARD_DRAG_THRESHOLD = 6;
export const BENCHMARK_CARD_SLOT_TRANSITION_MS = 190;
export const BENCHMARK_CARD_AUTO_SCROLL = Object.freeze({
  startInset: 52,
  outsideExtensionRatio: 0.2,
  minimumOutsideExtension: 96,
  maximumOutsideExtension: 180,
  maximumSpeed: 16,
});
export const BENCHMARK_CARD_AUTO_SCROLL_EDGE = BENCHMARK_CARD_AUTO_SCROLL.startInset;
export const BENCHMARK_CARD_AUTO_SCROLL_MAX = BENCHMARK_CARD_AUTO_SCROLL.maximumSpeed;

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
  const outsideExtension = calculateCanvasCardAutoScrollOutsideExtension(listBottom - listTop);
  const topStart = listTop + BENCHMARK_CARD_AUTO_SCROLL.startInset;
  const bottomStart = listBottom - BENCHMARK_CARD_AUTO_SCROLL.startInset;
  if (pointerY < topStart) {
    const progress = normalizedProgress(pointerY, topStart, listTop - outsideExtension);
    return -BENCHMARK_CARD_AUTO_SCROLL.maximumSpeed * smoothstep(progress);
  }
  if (pointerY > bottomStart) {
    const progress = normalizedProgress(pointerY, bottomStart, listBottom + outsideExtension);
    return BENCHMARK_CARD_AUTO_SCROLL.maximumSpeed * smoothstep(progress);
  }
  return 0;
}

export function calculateCanvasCardAutoScrollOutsideExtension(browserBodyHeight: number) {
  return Math.min(
    BENCHMARK_CARD_AUTO_SCROLL.maximumOutsideExtension,
    Math.max(
      BENCHMARK_CARD_AUTO_SCROLL.minimumOutsideExtension,
      browserBodyHeight * BENCHMARK_CARD_AUTO_SCROLL.outsideExtensionRatio,
    ),
  );
}

export function calculateBoundedCanvasCardScrollTop(
  currentScrollTop: number,
  delta: number,
  clientHeight: number,
  scrollHeight: number,
) {
  const maximumScrollTop = Math.max(0, scrollHeight - clientHeight);
  return Math.min(maximumScrollTop, Math.max(0, currentScrollTop + delta));
}

function normalizedProgress(value: number, start: number, end: number) {
  return Math.min(1, Math.max(0, (value - start) / (end - start)));
}

function smoothstep(progress: number) {
  return progress * progress * (3 - 2 * progress);
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
