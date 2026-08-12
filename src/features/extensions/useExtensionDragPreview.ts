import { type PointerEvent as ReactPointerEvent, useEffect, useRef } from "react";
import type { ExtensionId } from "../../extensions/registry";

export function useExtensionDragPreview(
  onDrop?: (extensionId: ExtensionId, clientX: number, clientY: number) => void,
) {
  const cleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanupRef.current?.(), []);

  return (extensionId: ExtensionId, event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    cleanupRef.current?.();
    const start = { x: event.clientX, y: event.clientY };
    const clone = event.currentTarget.cloneNode(true) as HTMLElement;
    clone.classList.add("taskmap-extension-card--drag-preview");
    clone.style.visibility = "hidden";
    document.body.append(clone);
    let latest = start;
    let frame = 0;
    let active = false;
    const present = () => {
      frame = 0;
      if (!active && Math.hypot(latest.x - start.x, latest.y - start.y) > 6) active = true;
      clone.style.visibility = active ? "visible" : "hidden";
      clone.style.transform = `translate3d(${latest.x + 10}px, ${latest.y + 10}px, 0)`;
    };
    const move = (pointerEvent: PointerEvent) => {
      if (pointerEvent.pointerId !== event.pointerId) return;
      latest = { x: pointerEvent.clientX, y: pointerEvent.clientY };
      if (!frame) frame = requestAnimationFrame(present);
    };
    const cleanup = () => {
      if (frame) cancelAnimationFrame(frame);
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", cancel);
      clone.remove();
      cleanupRef.current = null;
    };
    const up = (pointerEvent: PointerEvent) => {
      if (pointerEvent.pointerId !== event.pointerId) return;
      if (active) onDrop?.(extensionId, pointerEvent.clientX, pointerEvent.clientY);
      cleanup();
    };
    const cancel = (pointerEvent: PointerEvent) => {
      if (pointerEvent.pointerId === event.pointerId) cleanup();
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
    document.addEventListener("pointercancel", cancel);
    cleanupRef.current = cleanup;
  };
}
