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

export function calculateCanvasCardInsertionIndex(
  order: readonly number[],
  draggedId: number,
  centerY: number,
  listTop: number,
  scrollTop: number,
  slotSize: number,
) {
  let targetIndex = order.indexOf(draggedId);
  if (targetIndex < 0) return -1;

  const centerInListSpace = centerY + scrollTop - listTop;
  while (
    targetIndex < order.length - 1 &&
    centerInListSpace >= (targetIndex + 1) * slotSize + slotSize / 2
  ) {
    targetIndex += 1;
  }
  while (targetIndex > 0 && centerInListSpace <= (targetIndex - 1) * slotSize + slotSize / 2) {
    targetIndex -= 1;
  }
  return targetIndex;
}

export function reorderCanvasCardToIndex(
  order: readonly number[],
  draggedId: number,
  targetIndex: number,
) {
  const fromIndex = order.indexOf(draggedId);
  if (
    fromIndex < 0 ||
    targetIndex < 0 ||
    targetIndex >= order.length ||
    fromIndex === targetIndex
  ) {
    return order;
  }
  const next = [...order];
  const [dragged] = next.splice(fromIndex, 1);
  next.splice(targetIndex, 0, dragged);
  return next;
}

export function calculateCanvasCardInteractionCenter(
  pointerY: number,
  pointerOffsetY: number,
  listTop: number,
  listBottom: number,
  cardHeight: number,
) {
  const effectivePointerY = Math.min(listBottom, Math.max(listTop, pointerY));
  return effectivePointerY - pointerOffsetY + cardHeight / 2;
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

function normalizedProgress(value: number, start: number, end: number) {
  return Math.min(1, Math.max(0, (value - start) / (end - start)));
}

function smoothstep(progress: number) {
  return progress * progress * (3 - 2 * progress);
}

export function haveSameCanvasCardIds(left: readonly number[], right: readonly number[]) {
  return left.length === right.length && left.every((id) => right.includes(id));
}
