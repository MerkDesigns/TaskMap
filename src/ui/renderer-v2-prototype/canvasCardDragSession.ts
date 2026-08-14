import type { CanvasCardPointerSession } from "./canvasCardPointerSession";
import type { CanvasCardDragState } from "./liquidCanvasBrowserTypes";

interface BeginCanvasCardDragOptions {
  readonly id: number;
  readonly event: PointerEvent;
  readonly element: HTMLElement;
  readonly displayOrder: readonly number[];
  readonly cardTop: number;
  readonly currentDrag: CanvasCardDragState | null;
  readonly pointerSession: CanvasCardPointerSession;
  readonly getDrag: () => CanvasCardDragState | null;
  readonly setDrag: (drag: CanvasCardDragState | null) => void;
  readonly invalidate: () => void;
}

export function beginCanvasCardDragSession(options: BeginCanvasCardDragOptions) {
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

function updatePointer(options: BeginCanvasCardDragOptions, event: PointerEvent) {
  const drag = options.getDrag();
  if (!drag || drag.pointerId !== event.pointerId) return;
  event.preventDefault();
  drag.pointerY = event.clientY;
  options.invalidate();
}

function finishPointer(
  options: BeginCanvasCardDragOptions,
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
