import { useEffect } from "react";
import type { CanvasPoint } from "../../../canvas/geometry/canvasGeometry";
import type { BenchmarkViewportController } from "./benchmarkViewportController";

export interface BenchmarkSpawnMenuRequest {
  screen: CanvasPoint;
  world: CanvasPoint;
}

function localPoint(event: MouseEvent | PointerEvent | WheelEvent, rect: DOMRect) {
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function belongsToInteractiveObject(target: EventTarget | null) {
  return (
    target instanceof Element &&
    Boolean(target.closest("[data-benchmark-element], [data-benchmark-glass]"))
  );
}

export function useBenchmarkCanvasInput(
  target: HTMLElement | null,
  viewport: BenchmarkViewportController,
  requestSpawnMenu: (request: BenchmarkSpawnMenuRequest | null) => void,
  setCameraActive?: (active: boolean) => void,
) {
  useEffect(() => {
    if (!target) return;
    let bounds = target.getBoundingClientRect();
    let wheelIdleTimer: number | null = null;

    const pointerDown = (event: PointerEvent) => {
      bounds = target.getBoundingClientRect();
      const objectTarget = belongsToInteractiveObject(event.target);
      const shouldPan =
        event.button === 1 ||
        (event.button === 0 && event.ctrlKey) ||
        (event.button === 0 && !objectTarget);
      if (!shouldPan || !viewport.beginPan(event.pointerId, localPoint(event, bounds))) return;
      event.preventDefault();
      requestSpawnMenu(null);
      target.dataset.panning = "true";
      setCameraActive?.(true);
      target.setPointerCapture?.(event.pointerId);
    };
    const pointerMove = (event: PointerEvent) =>
      viewport.updatePan(event.pointerId, localPoint(event, bounds));
    const pointerEnd = (event: PointerEvent) => {
      viewport.endPan(event.pointerId);
      target.removeAttribute("data-panning");
      setCameraActive?.(false);
      if (target.hasPointerCapture?.(event.pointerId))
        target.releasePointerCapture(event.pointerId);
    };
    const wheel = (event: WheelEvent) => {
      if (event.target instanceof Element && event.target.closest("[data-benchmark-glass]")) return;
      event.preventDefault();
      setCameraActive?.(true);
      if (wheelIdleTimer !== null) window.clearTimeout(wheelIdleTimer);
      wheelIdleTimer = window.setTimeout(() => {
        wheelIdleTimer = null;
        setCameraActive?.(false);
      }, 120);
      viewport.wheel(localPoint(event, bounds), event.deltaY);
    };
    const contextMenu = (event: MouseEvent) => {
      event.preventDefault();
      if (belongsToInteractiveObject(event.target)) return requestSpawnMenu(null);
      const screen = localPoint(event, bounds);
      requestSpawnMenu({
        screen: { x: event.clientX, y: event.clientY },
        world: viewport.worldAt(screen),
      });
    };
    const resize = () => {
      bounds = target.getBoundingClientRect();
      viewport.resize({ width: target.clientWidth, height: target.clientHeight });
    };

    target.addEventListener("pointerdown", pointerDown);
    target.addEventListener("pointermove", pointerMove);
    target.addEventListener("pointerup", pointerEnd);
    target.addEventListener("pointercancel", pointerEnd);
    target.addEventListener("wheel", wheel, { passive: false });
    target.addEventListener("contextmenu", contextMenu);
    const observer = new ResizeObserver(resize);
    observer.observe(target);
    resize();
    return () => {
      if (wheelIdleTimer !== null) window.clearTimeout(wheelIdleTimer);
      setCameraActive?.(false);
      observer.disconnect();
      target.removeEventListener("pointerdown", pointerDown);
      target.removeEventListener("pointermove", pointerMove);
      target.removeEventListener("pointerup", pointerEnd);
      target.removeEventListener("pointercancel", pointerEnd);
      target.removeEventListener("wheel", wheel);
      target.removeEventListener("contextmenu", contextMenu);
    };
  }, [requestSpawnMenu, setCameraActive, target, viewport]);
}
