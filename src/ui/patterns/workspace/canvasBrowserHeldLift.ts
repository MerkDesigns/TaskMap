import { CANVAS_CARD_SLOT_TRANSITION_MS, easeOutQuart } from "./canvasBrowserInteraction";
import type { CanvasBrowserCardRecord, CanvasCardDragState } from "./canvasBrowserRuntimeTypes";

/** Held-card lift (glass contract section 14): the picked-up card grows by this factor. */
export const CANVAS_CARD_HELD_SCALE = 1.06;

/** Neighbours move away from the held card so its gaps stay even while it is enlarged. */
export interface CanvasCardHeldSpread<Id extends string> {
  readonly id: Id;
  readonly amount: number;
}

export function canvasCardHeldSpread<Id extends string>(
  drag: CanvasCardDragState<Id>,
  record: CanvasBrowserCardRecord<Id>,
): CanvasCardHeldSpread<Id> {
  return { id: drag.id, amount: (record.height * (CANVAS_CARD_HELD_SCALE - 1)) / 2 };
}

/**
 * Scales the held card up after pickup and back to its settled size during the drop snap, on the
 * same timing as the neighbours' slot motion so both read as one movement.
 */
export function tickCanvasCardLift<Id extends string>(
  drag: CanvasCardDragState<Id>,
  record: CanvasBrowserCardRecord<Id>,
  now: number,
  reducedMotion: boolean,
): void {
  const progress = (startedAt: number | null) =>
    reducedMotion
      ? 1
      : easeOutQuart(Math.min(1, (now - (startedAt ?? now)) / CANVAS_CARD_SLOT_TRANSITION_MS));
  drag.scale =
    drag.snapStartedAt === null
      ? 1 + (CANVAS_CARD_HELD_SCALE - 1) * progress(drag.liftStartedAt)
      : drag.snapFromScale + (1 - drag.snapFromScale) * progress(drag.snapStartedAt);
  record.host.style.setProperty("--taskmap-canvas-card-scale", String(drag.scale));
}
