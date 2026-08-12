import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { CanvasId } from "../../domain/ids/entityIds";
import type { LiquidMaterialSurfaceHandle } from "../../ui/materials/liquid-dom";
import { reorderAtPointerMidpoint, type CanvasReorderRow } from "./canvasReorderMath";
import { useCanvasReorderFlip } from "./useCanvasReorderFlip";

const ACTIVATION_DISTANCE = 6;

interface DragState {
  readonly id: CanvasId;
  readonly pointerId: number;
  readonly startY: number;
  readonly offsetY: number;
  readonly source: HTMLDivElement;
  readonly clone: HTMLElement;
  readonly documentOrder: readonly CanvasId[];
  readonly externalRevision: unknown;
  currentY: number;
  previousY: number;
  active: boolean;
  frame: number | null;
  rows: CanvasReorderRow<CanvasId>[];
  cleanup: () => void;
}

export function useCanvasPointerReorder(
  documentOrder: readonly CanvasId[],
  onCommit: (order: readonly CanvasId[]) => void,
  externalRevision: unknown = documentOrder,
) {
  const [displayOrder, setDisplayOrder] = useState(documentOrder);
  const [draggingId, setDraggingId] = useState<CanvasId | null>(null);
  const displayOrderRef = useRef(displayOrder);
  const documentOrderRef = useRef(documentOrder);
  const onCommitRef = useRef(onCommit);
  const dragRef = useRef<DragState | null>(null);
  const cardNodes = useRef(new Map<CanvasId, HTMLDivElement>());
  const surfaceHandles = useRef(new Map<CanvasId, LiquidMaterialSurfaceHandle>());
  const firstRects = useRef<Map<CanvasId, DOMRect> | null>(null);
  const suppressClickRef = useRef(false);

  displayOrderRef.current = displayOrder;
  documentOrderRef.current = documentOrder;
  onCommitRef.current = onCommit;

  const readRows = useCallback(
    (order: readonly CanvasId[]) =>
      order.flatMap((id) => {
        const rect = cardNodes.current.get(id)?.getBoundingClientRect();
        return rect ? [{ id, top: rect.top, height: rect.height }] : [];
      }),
    [],
  );

  const finish = useCallback((commit: boolean) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.frame !== null) cancelAnimationFrame(drag.frame);
    drag.cleanup();
    drag.clone.remove();
    drag.source.style.opacity = "";
    surfaceHandles.current.get(drag.id)?.setPresentationOpacity(1);
    try {
      if (drag.source.hasPointerCapture(drag.pointerId)) {
        drag.source.releasePointerCapture(drag.pointerId);
      }
    } catch {
      // The document fallback can finish after the source is detached.
    }
    dragRef.current = null;
    setDraggingId(null);
    if (commit && drag.active) onCommitRef.current(displayOrderRef.current);
    else setDisplayOrder(documentOrderRef.current);
  }, []);

  const scheduleFrame = useCallback(() => {
    const drag = dragRef.current;
    if (!drag || drag.frame !== null) return;
    drag.frame = requestAnimationFrame(() => {
      drag.frame = null;
      const distance = Math.abs(drag.currentY - drag.startY);
      if (!drag.active && distance > ACTIVATION_DISTANCE) {
        drag.active = true;
        suppressClickRef.current = true;
        setDraggingId(drag.id);
      }
      drag.clone.style.top = `${drag.currentY - drag.offsetY}px`;
      if (!drag.active) return;

      const next = reorderAtPointerMidpoint(
        displayOrderRef.current,
        drag.rows,
        drag.id,
        drag.currentY,
        drag.previousY,
      );
      if (next !== displayOrderRef.current) {
        firstRects.current = new Map(
          displayOrderRef.current.flatMap((id) => {
            const rect = surfaceHandles.current.get(id)?.anchor?.getBoundingClientRect();
            return rect ? [[id, rect] as const] : [];
          }),
        );
        drag.previousY = drag.currentY;
        displayOrderRef.current = next;
        setDisplayOrder(next);
      }
    });
  }, []);

  const onPointerDown = useCallback(
    (id: CanvasId, event: ReactPointerEvent<HTMLDivElement>) => {
      if (
        event.button !== 0 ||
        dragRef.current ||
        (event.target as HTMLElement).closest("button, input, [role='menuitem']")
      )
        return;
      const source = event.currentTarget;
      const rect = source.getBoundingClientRect();
      const clone = source.cloneNode(true) as HTMLElement;
      clone.classList.add("taskmap-canvas-card--drag-clone");
      Object.assign(clone.style, {
        position: "fixed",
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        pointerEvents: "none",
        zIndex: "10000",
      });
      document.body.append(clone);
      source.style.opacity = "0";
      surfaceHandles.current.get(id)?.setPresentationOpacity(0);
      try {
        source.setPointerCapture(event.pointerId);
      } catch {
        // Document listeners below remain the fallback.
      }

      const onMove = (pointerEvent: PointerEvent) => {
        const drag = dragRef.current;
        if (!drag || pointerEvent.pointerId !== drag.pointerId) return;
        drag.currentY = pointerEvent.clientY;
        scheduleFrame();
      };
      const onUp = (pointerEvent: PointerEvent) => {
        if (dragRef.current?.pointerId === pointerEvent.pointerId) finish(true);
      };
      const onCancel = (pointerEvent: PointerEvent) => {
        if (dragRef.current?.pointerId === pointerEvent.pointerId) finish(false);
      };
      const cleanup = () => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.removeEventListener("pointercancel", onCancel);
      };
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      document.addEventListener("pointercancel", onCancel);
      dragRef.current = {
        id,
        pointerId: event.pointerId,
        startY: event.clientY,
        currentY: event.clientY,
        previousY: event.clientY,
        offsetY: event.clientY - rect.top,
        active: false,
        documentOrder: [...documentOrder],
        externalRevision,
        rows: readRows(displayOrderRef.current),
        source,
        clone,
        frame: null,
        cleanup,
      };
      event.preventDefault();
    },
    [documentOrder, externalRevision, finish, readRows, scheduleFrame],
  );

  const syncRowsAfterLayout = useCallback(() => {
    const drag = dragRef.current;
    if (drag) drag.rows = readRows(displayOrder);
  }, [displayOrder, readRows]);
  useCanvasReorderFlip(displayOrder, firstRects, surfaceHandles, syncRowsAfterLayout);

  useEffect(() => {
    const drag = dragRef.current;
    if (
      drag &&
      (drag.externalRevision !== externalRevision || !sameOrder(drag.documentOrder, documentOrder))
    )
      finish(false);
    else if (!drag) setDisplayOrder(documentOrder);
  }, [documentOrder, externalRevision, finish]);

  useEffect(() => () => finish(false), [finish]);

  return {
    displayOrder,
    draggingId,
    onPointerDown,
    registerCardNode: (id: CanvasId, node: HTMLDivElement | null) => {
      if (node) cardNodes.current.set(id, node);
      else cardNodes.current.delete(id);
    },
    registerSurface: (id: CanvasId, handle: LiquidMaterialSurfaceHandle | null) => {
      if (handle) surfaceHandles.current.set(id, handle);
      else surfaceHandles.current.delete(id);
    },
    consumeSuppressedClick() {
      const suppressed = suppressClickRef.current;
      suppressClickRef.current = false;
      return suppressed;
    },
    cancel: () => finish(false),
  };
}

function sameOrder(left: readonly CanvasId[], right: readonly CanvasId[]) {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}
