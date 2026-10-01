import { useLayoutEffect, type RefObject } from "react";
import { writeSharedSmallGlassShapes } from "../../materials/SharedSmallGlassPlane";
import { recordMaterialGeometryRefresh } from "../../materials/materialPerformanceDiagnostics";
import {
  registerMaterialGeometryWork,
  type MaterialGeometryFrame,
  type MaterialGeometryReason,
} from "../../materials/materialGeometryScheduler";
import { supplyMaterialSurfaceSize } from "../../materials/materialGeometryInvalidation";
import {
  glassListSliceInsets,
  glassListSlicedSize,
  readGlassListLayout,
  projectGlassListSlices,
  type GlassListSlice,
} from "./glassListScrollGeometry";

interface SharedSmallGlassListOptions {
  readonly active: boolean;
  readonly cardSelector: string;
  /**
   * Settled scroll-edge morph: edge cards shrink their body, rim,
   * shadow and rounded content mask to the visible slice. Requires cards that use the shared
   * `.taskmap-glass-list__content` mask.
   */
  readonly morph?: boolean;
  readonly planeRef: RefObject<HTMLElement | null>;
  readonly viewportRef: RefObject<HTMLElement | null>;
}

export function useSharedSmallGlassList({
  active,
  cardSelector,
  morph = false,
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
    const slices = new Map<HTMLElement, string>();
    const sync = (frame: MaterialGeometryFrame, reason: MaterialGeometryReason) => {
      recordMaterialGeometryRefresh();
      const rimWrites: (() => void)[] = [];
      const relayout = !layout || reason === "layout";
      if (relayout) layout = readGlassListLayout(frame, viewport, plane, cardSelector);
      const projected = projectGlassListSlices(layout!);
      const sliceWrites: (() => void)[] = [];
      for (const card of projected) {
        const size = morph ? glassListSlicedSize(card) : card.size;
        if (morph || relayout) {
          const writeRim = supplyMaterialSurfaceSize(card.element, size);
          if (writeRim) rimWrites.push(writeRim);
        }
        if (morph) {
          const write = sliceWriter(card, slices);
          if (write) sliceWrites.push(write);
        }
      }
      const shapes = projected.flatMap(({ shape }) =>
        shape ? [morph ? { ...shape, morph: true } : shape] : [],
      );
      return () => {
        sliceWrites.forEach((write) => write());
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
      slices.forEach((_, element) => clearSlice(element));
    };
  }, [active, cardSelector, morph, planeRef, viewportRef]);
}

const SLICE_PROPERTIES = ["top", "right", "bottom", "left"] as const;

function sliceWriter(card: GlassListSlice, written: Map<HTMLElement, string>) {
  const insets = glassListSliceInsets(card);
  const unmeasured = card.size.width === 0 || card.size.height === 0;
  const key = insets ? insets.join(",") : unmeasured ? "unmeasured" : "hidden";
  if (written.get(card.element) === key) return;
  written.set(card.element, key);
  // A card without layout (not rendered yet) has nothing to slice; leave it untouched.
  if (!insets && unmeasured) return () => clearSlice(card.element);
  // Cards wholly outside the visible area (e.g. in the shadow gutter) are hidden, not stale.
  if (!insets) return () => (card.element.dataset.glassListSlice = "hidden");
  return () => {
    card.element.dataset.glassListSlice = "true";
    SLICE_PROPERTIES.forEach((side, index) =>
      card.element.style.setProperty(`--taskmap-glass-list-slice-${side}`, `${insets[index]}px`),
    );
  };
}

function clearSlice(element: HTMLElement) {
  delete element.dataset.glassListSlice;
  SLICE_PROPERTIES.forEach((side) =>
    element.style.removeProperty(`--taskmap-glass-list-slice-${side}`),
  );
}
