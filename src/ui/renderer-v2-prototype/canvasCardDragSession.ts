import type { CanvasCardPointerSession } from "./canvasCardPointerSession";
import type { CanvasBrowserItemId, CanvasCardDragState } from "./liquidCanvasBrowserTypes";

interface BeginCanvasCardDragOptions<Id extends string> {
  readonly id: Id;
  readonly event: PointerEvent;
  readonly element: HTMLElement;
  readonly displayOrder: readonly Id[];
  readonly cardTop: number;
  readonly currentDrag: CanvasCardDragState<Id> | null;
  readonly pointerSession: CanvasCardPointerSession;
  readonly getDrag: () => CanvasCardDragState<Id> | null;
  readonly setDrag: (drag: CanvasCardDragState<Id> | null) => void;
  readonly invalidate: () => void;
}

export function beginCanvasCardDragSession<Id extends string = CanvasBrowserItemId>(
  options: BeginCanvasCardDragOptions<Id>,
) {
  const { id, event, displayOrder, cardTop } = options;
  if (event.button !== 0 || options.currentDrag) return false;
  if (displayOrder.indexOf(id) < 0) return false;
  event.preventDefault();
  options.setDrag({
    id,
    pointerId: event.pointerId,
    startY: event.clientY,
    pointerY: event.clientY,
    pointerOffsetY: event.clientY - cardTop,
    initialOrder: [...displayOrder],
    order: [...displayOrder],
    active: false,
    finish: null,
    snapStartedAt: null,
    snapFromY: cardTop,
  });
  options.pointerSession.begin(
    options.element,
    event.pointerId,
    (pointerEvent) => updatePointer(options, pointerEvent),
    (pointerEvent, finish) => finishPointer(options, pointerEvent, finish),
  );
  options.invalidate();
  return true;
}

function updatePointer<Id extends string>(
  options: BeginCanvasCardDragOptions<Id>,
  event: PointerEvent,
) {
  const drag = options.getDrag();
  if (!drag || drag.pointerId !== event.pointerId) return;
  event.preventDefault();
  drag.pointerY = event.clientY;
  options.invalidate();
}

function finishPointer<Id extends string>(
  options: BeginCanvasCardDragOptions<Id>,
  event: PointerEvent,
  finish: "commit" | "cancel",
) {
  const drag = options.getDrag();
  if (!drag || drag.pointerId !== event.pointerId) return;
  drag.pointerY = event.clientY;
  if (drag.active) drag.finish = finish;
  else options.setDrag(null);
  options.pointerSession.release(event.pointerId);
  options.invalidate();
}
