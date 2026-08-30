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
      if (plane) {
        writeSharedSmallGlassShapes(plane, []);
        hideSharedSmallShadows(plane);
      }
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
      const planeRectangle = plane.getBoundingClientRect();
      const shadows = sharedSmallShadows(plane);
      shadows.forEach((shadow) => {
        delete shadow.dataset.sharedSmallGlassShadowVisible;
      });
      const shapes = [...viewport.querySelectorAll<HTMLElement>(cardSelector)].flatMap((card) => {
        const rectangle = card.getBoundingClientRect();
        const localViewport = card.closest<HTMLElement>("[data-shared-small-glass-viewport]");
        const localRectangle = localViewport?.getBoundingClientRect();
        const left = Math.max(rectangle.left, viewportRectangle.left, localRectangle?.left ?? -Infinity);
        const top = Math.max(rectangle.top, viewportRectangle.top, localRectangle?.top ?? -Infinity);
        const right = Math.min(
          rectangle.right,
          viewportRectangle.right,
          localRectangle?.right ?? Infinity,
        );
        const bottom = Math.min(
          rectangle.bottom,
          viewportRectangle.bottom,
          localRectangle?.bottom ?? Infinity,
        );
        if (right <= left || bottom <= top) return [];
        const shadowId = card.dataset.sharedSmallGlassShadowItem;
        const shadow = shadowId ? shadows.get(shadowId) : undefined;
        if (shadow) {
          shadow.style.width = `${rectangle.width}px`;
          shadow.style.height = `${rectangle.height}px`;
          shadow.style.borderRadius = card.style.getPropertyValue("--taskmap-material-radius");
          shadow.style.transform = `translate3d(${rectangle.left - planeRectangle.left}px, ${rectangle.top - planeRectangle.top}px, 0)`;
          shadow.dataset.sharedSmallGlassShadowVisible = "true";
        }
        return [
          {
            x: left - viewportRectangle.left,
            y: top - viewportRectangle.top,
            width: right - left,
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
    viewport.addEventListener("scroll", schedule, { capture: true, passive: true });
    window.addEventListener("resize", schedule);
    mutationObserver.observe(viewport, { childList: true, subtree: true });
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      mutationObserver.disconnect();
      viewport.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      writeSharedSmallGlassShapes(plane, []);
      hideSharedSmallShadows(plane);
    };
  }, [active, cardSelector, planeRef, viewportRef]);
}

function sharedSmallShadows(plane: HTMLElement): Map<string, HTMLElement> {
  return new Map(
    [...plane.querySelectorAll<HTMLElement>("[data-shared-small-glass-shadow]")].flatMap(
      (shadow) => {
        const id = shadow.dataset.sharedSmallGlassShadow;
        return id ? [[id, shadow] as const] : [];
      },
    ),
  );
}

function hideSharedSmallShadows(plane: HTMLElement): void {
  sharedSmallShadows(plane).forEach((shadow) => {
    delete shadow.dataset.sharedSmallGlassShadowVisible;
  });
}
