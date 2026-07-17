import {
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ExtensionId } from "./registry";

export type ExtensionDragState = {
  extensionId: ExtensionId;
  clientX: number;
  clientY: number;
};

type UseExtensionDragOptions = {
  sourceRef: RefObject<HTMLElement>;
  onDropExtension: (extensionId: ExtensionId, clientX: number, clientY: number) => void;
  onDragExtension?: (extensionId: ExtensionId | null, clientX?: number, clientY?: number) => void;
  onDropComplete?: () => void;
};

const pointInside = (element: HTMLElement | null, clientX: number, clientY: number) => {
  if (!element) {
    return false;
  }

  const bounds = element.getBoundingClientRect();
  return (
    clientX >= bounds.left &&
    clientX <= bounds.right &&
    clientY >= bounds.top &&
    clientY <= bounds.bottom
  );
};

export function useExtensionDrag({
  sourceRef,
  onDropExtension,
  onDragExtension,
  onDropComplete,
}: UseExtensionDragOptions) {
  const [drag, setDrag] = useState<ExtensionDragState | null>(null);
  const dragRef = useRef<ExtensionDragState | null>(null);
  const dragActive = drag !== null;

  useEffect(() => {
    dragRef.current = drag;
  }, [drag]);

  const clearDrag = useCallback(() => {
    dragRef.current = null;
    setDrag(null);
    onDragExtension?.(null);
  }, [onDragExtension]);

  useEffect(() => {
    if (!dragActive) {
      return;
    }

    const handlePointerMove = (event: globalThis.PointerEvent) => {
      const current = dragRef.current;
      if (!current) {
        return;
      }

      const next = { ...current, clientX: event.clientX, clientY: event.clientY };
      dragRef.current = next;
      setDrag(next);
      onDragExtension?.(next.extensionId, next.clientX, next.clientY);
    };

    const handlePointerEnd = (event: globalThis.PointerEvent) => {
      const current = dragRef.current;
      if (!current) {
        return;
      }

      const droppedInsideSource = pointInside(sourceRef.current, event.clientX, event.clientY);
      clearDrag();
      if (!droppedInsideSource) {
        onDropExtension(current.extensionId, event.clientX, event.clientY);
        onDropComplete?.();
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", clearDrag);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", clearDrag);
    };
  }, [clearDrag, dragActive, onDragExtension, onDropComplete, onDropExtension, sourceRef]);

  const startExtensionDrag = useCallback(
    (event: ReactPointerEvent<HTMLElement>, extensionId: ExtensionId) => {
      if (event.button !== 0) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      const next = { extensionId, clientX: event.clientX, clientY: event.clientY };
      dragRef.current = next;
      setDrag(next);
      onDragExtension?.(extensionId, event.clientX, event.clientY);
    },
    [onDragExtension],
  );

  return { drag, startExtensionDrag };
}
