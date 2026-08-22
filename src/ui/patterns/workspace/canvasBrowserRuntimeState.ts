import { writeCanvasBrowserContentHeight } from "./canvasBrowserDom";
import { canvasCardContentHeight } from "./canvasBrowserSlotGeometry";
import type { CanvasBrowserScrollState } from "./canvasBrowserScrollState";
import type { CanvasBrowserCardRecord, CanvasCardDragState } from "./canvasBrowserRuntimeTypes";
import type { CanvasBrowserViewportController } from "./canvasBrowserViewport";

export function canvasBrowserRuntimeSnapshot<Id extends string>(
  order: readonly Id[],
  drag: CanvasCardDragState<Id> | null,
  scroll: CanvasBrowserScrollState,
) {
  return { order: [...order], dragActive: drag?.active ?? false, scroll: scroll.snapshot() };
}

export function canvasBrowserRuntimeNeedsFrame(
  scroll: CanvasBrowserScrollState,
  dragActive: boolean,
  slotAnimationActive: boolean,
): boolean {
  return scroll.currentScrollY !== scroll.targetScrollY || dragActive || slotAnimationActive;
}

export function updateCanvasBrowserScrollRange<Id extends string>(
  panel: HTMLElement,
  cardsLayer: HTMLElement,
  viewport: CanvasBrowserViewportController<Id>,
  scroll: CanvasBrowserScrollState,
  order: readonly Id[],
  records: ReadonlyMap<Id, CanvasBrowserCardRecord<Id>>,
): void {
  const contentHeight = canvasCardContentHeight(order, records);
  writeCanvasBrowserContentHeight(panel, cardsLayer, contentHeight);
  scroll.setRange(viewport.height(), contentHeight);
}
