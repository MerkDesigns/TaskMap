import { CANVAS_CARD_PICKUP_MS, easeOutQuart } from "./canvasBrowserInteraction";
import {
  canvasBrowserCardSlice,
  interpolateSlice,
  writeCanvasBrowserCardViewport,
} from "./canvasBrowserDom";
import type { CanvasBrowserCardRecord, CanvasCardDragState } from "./canvasBrowserRuntimeTypes";

/**
 * Liquid pickup: a partly shrunk edge card expands from its settled
 * slice to the full held silhouette over `CANVAS_CARD_PICKUP_MS`.
 */
export function tickCanvasCardPickup<Id extends string>(
  drag: CanvasCardDragState<Id>,
  record: CanvasBrowserCardRecord<Id>,
  now: number,
  reducedMotion: boolean,
): void {
  if (drag.pickupStartedAt === null) return;
  const progress = reducedMotion
    ? 1
    : Math.min(1, (now - drag.pickupStartedAt) / CANVAS_CARD_PICKUP_MS);
  const full = { offset: 0, visible: record.height };
  writeSlice(record, interpolateSlice(drag.pickupFrom, full, easeOutQuart(progress)));
  if (progress >= 1) drag.pickupStartedAt = null;
}

/** Drop morphs toward the destination's settled slice so the batch handoff is seamless. */
export function writeCanvasCardDropSlice<Id extends string>(
  drag: CanvasCardDragState<Id>,
  record: CanvasBrowserCardRecord<Id>,
  targetTop: number,
  viewportHeight: number,
  eased: number,
): void {
  const destination =
    viewportHeight > 0
      ? canvasBrowserCardSlice(targetTop, record.height, viewportHeight)
      : { offset: 0, visible: record.height };
  writeSlice(record, interpolateSlice(drag.snapFromSlice, destination, eased));
}

function writeSlice<Id extends string>(
  record: CanvasBrowserCardRecord<Id>,
  slice: { readonly offset: number; readonly visible: number },
) {
  writeCanvasBrowserCardViewport(record, slice.offset, slice.visible, true);
}
