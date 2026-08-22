import { useLayoutEffect, type RefObject } from "react";
import { writeSharedSmallGlassShapes } from "../../materials/SharedSmallGlassPlane";
import { recordMaterialGeometryRefresh } from "../../materials/materialPerformanceDiagnostics";

interface SharedSmallGlassListOptions {
  readonly active: boolean;
  readonly cardSelector: string;
  readonly planeRef: RefObject<HTMLElement | null>;
  readonly viewportRef: RefObject<HTMLElement | null>;
}

export function useSharedSmallGlassList({
  active,
  cardSelector,
  planeRef,
  viewportRef,
}: SharedSmallGlassListOptions): void {
  useLayoutEffect(() => {
    const plane = planeRef.current;
    const viewport = viewportRef.current;
    if (!active || !plane || !viewport) {
      if (plane) writeSharedSmallGlassShapes(plane, []);
      return;
    }
    let frame: number | null = null;
    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => schedule());
    const observeCards = () => {
      resizeObserver?.disconnect();
      resizeObserver?.observe(viewport);
      viewport.querySelectorAll<HTMLElement>(cardSelector).forEach((card) => {
        resizeObserver?.observe(card);
      });
    };
    const sync = () => {
      frame = null;
      recordMaterialGeometryRefresh();
      const viewportRectangle = viewport.getBoundingClientRect();
      const shapes = [...viewport.querySelectorAll<HTMLElement>(cardSelector)].flatMap((card) => {
        const rectangle = card.getBoundingClientRect();
        const top = Math.max(rectangle.top, viewportRectangle.top);
        const bottom = Math.min(rectangle.bottom, viewportRectangle.bottom);
        if (rectangle.width <= 0 || bottom <= top) return [];
        return [
          {
            x: rectangle.left - viewportRectangle.left,
            y: top - viewportRectangle.top,
            width: rectangle.width,
            height: bottom - top,
            radius:
              Number.parseFloat(card.style.getPropertyValue("--taskmap-material-radius")) || 0,
          },
        ];
      });
      writeSharedSmallGlassShapes(plane, shapes);
    };
    const schedule = () => {
      if (frame !== null) return;
      frame = requestAnimationFrame(sync);
    };
    const mutationObserver = new MutationObserver(() => {
      observeCards();
      schedule();
    });

    observeCards();
    sync();
    viewport.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    mutationObserver.observe(viewport, { childList: true, subtree: true });
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      mutationObserver.disconnect();
      viewport.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      writeSharedSmallGlassShapes(plane, []);
    };
  }, [active, cardSelector, planeRef, viewportRef]);
}
