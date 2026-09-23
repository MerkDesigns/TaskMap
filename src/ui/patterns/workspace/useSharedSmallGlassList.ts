import { useLayoutEffect, type RefObject } from "react";
import { writeSharedSmallGlassShapes } from "../../materials/SharedSmallGlassPlane";
import { recordMaterialGeometryRefresh } from "../../materials/materialPerformanceDiagnostics";
import {
  registerMaterialGeometryWork,
  type MaterialGeometryFrame,
  type MaterialGeometryReason,
} from "../../materials/materialGeometryScheduler";
import { supplyMaterialSurfaceSize } from "../../materials/materialGeometryInvalidation";
import { readGlassListLayout, projectGlassListScroll } from "./glassListScrollGeometry";

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
    let layout: ReturnType<typeof readGlassListLayout> | undefined;
    const sync = (frame: MaterialGeometryFrame, reason: MaterialGeometryReason) => {
      recordMaterialGeometryRefresh();
      const rimWrites: (() => void)[] = [];
      if (!layout || reason === "layout") {
        layout = readGlassListLayout(frame, viewport, plane, cardSelector);
        for (const card of layout) {
          const writeRim = supplyMaterialSurfaceSize(card.element, card.size);
          if (writeRim) rimWrites.push(writeRim);
        }
      }
      const shapes = projectGlassListScroll(layout);
      return () => {
        rimWrites.forEach((write) => write());
        writeSharedSmallGlassShapes(plane, shapes);
      };
    };
    const geometry = registerMaterialGeometryWork(
      { owner: true, scrollRoot: viewport, descendantScroll: true, read: sync },
      [],
    );
    const observeCards = () => {
      const cards = [...viewport.querySelectorAll<HTMLElement>(cardSelector)];
      const clips = [
        ...viewport.querySelectorAll<HTMLElement>("[data-shared-small-glass-viewport]"),
      ];
      geometry.observe([viewport, ...cards, ...clips]);
    };
    const mutationObserver = new MutationObserver(() => {
      observeCards();
      geometry.invalidate();
    });
    observeCards();
    mutationObserver.observe(viewport, { childList: true, subtree: true });
    return () => {
      geometry.dispose();
      mutationObserver.disconnect();
      writeSharedSmallGlassShapes(plane, []);
    };
  }, [active, cardSelector, planeRef, viewportRef]);
}
