import { type MutableRefObject, useLayoutEffect } from "react";
import type { CanvasId } from "../../domain/ids/entityIds";
import type { LiquidMaterialSurfaceHandle } from "../../ui/materials/liquid-dom";

const FLIP_DURATION_MS = 190;
const FLIP_EASING = "cubic-bezier(0.16, 1, 0.3, 1)";

export function useCanvasReorderFlip(
  order: readonly CanvasId[],
  firstRects: MutableRefObject<Map<CanvasId, DOMRect> | null>,
  surfaceHandles: MutableRefObject<Map<CanvasId, LiquidMaterialSurfaceHandle>>,
  onLayout: () => void,
) {
  useLayoutEffect(() => {
    onLayout();
    const before = firstRects.current;
    if (!before) return;
    firstRects.current = null;
    let animationFrame = 0;
    let stopped = false;
    for (const id of order) {
      const handle = surfaceHandles.current.get(id);
      const anchor = handle?.anchor;
      const previous = before.get(id);
      if (!anchor || !previous) continue;
      const next = anchor.getBoundingClientRect();
      const dx = previous.left - next.left;
      const dy = previous.top - next.top;
      if (dx || dy) {
        anchor.animate([{ transform: `translate(${dx}px, ${dy}px)` }, {}], {
          duration: FLIP_DURATION_MS,
          easing: FLIP_EASING,
        });
      }
    }
    const refresh = () => {
      for (const handle of surfaceHandles.current.values()) handle.refresh();
      if (!stopped) animationFrame = requestAnimationFrame(refresh);
    };
    refresh();
    const timer = window.setTimeout(() => {
      stopped = true;
      cancelAnimationFrame(animationFrame);
      for (const handle of surfaceHandles.current.values()) handle.refresh();
    }, FLIP_DURATION_MS + 20);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      cancelAnimationFrame(animationFrame);
    };
  }, [firstRects, onLayout, order, surfaceHandles]);
}
