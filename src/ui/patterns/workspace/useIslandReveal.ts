import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import {
  supplyMaterialSurfaceSize,
  writeMaterialReveal,
} from "../../materials/materialGeometryInvalidation";
import type { MaterialSize } from "../../materials/materialGeometryScheduler";
import { useMotionFrameScheduler } from "../../motion/MotionProvider";
import { useReducedMotion } from "../../motion/reducedMotionPreference";
import { useChromeAsleep } from "./chromeSleep";

/**
 * A full expand and collapse, timed after the Windows calendar flyout: both start fast and settle
 * gently, expanding a little longer and softer than collapsing.
 */
const EXPAND = { durationMs: 270, easing: (progress: number) => 1 - (1 - progress) ** 4 };
const COLLAPSE = { durationMs: 170, easing: (progress: number) => 1 - (1 - progress) ** 3 };
/** A change of the expanded size (another view inside) never takes less than this share. */
const MIN_RESIZE_SHARE = 0.6;
/** Sleep mode's flight out; an island collapses only once it is out of sight. */
const SLEEP_FLIGHT_MS = 320;

export interface IslandRevealOptions {
  /** The island's surface: a `ToolbarGroup` with `geometrySource="owner"`. */
  readonly surfaceRef: RefObject<HTMLElement | null>;
  readonly width: number;
  /**
   * A narrower compact island, anchored at its right edge: it grows leftward and downward
   * together. Defaults to `width`, growing only downward.
   */
  readonly compactWidth?: number;
  readonly compactHeight: number;
  /** May change while expanded, when the island shows another view; the change animates. */
  readonly expandedHeight: number;
  /** Clicks elsewhere and Escape leave it expanded; only the island itself and sleep collapse it. */
  readonly staysOpen?: boolean;
  /** Something inside, such as an open menu, takes clicks elsewhere and Escape for itself. */
  readonly holdOpen?: boolean;
  /** Elements matching this selector toggle the island elsewhere, so pressing them is not outside. */
  readonly toggleSelector?: string;
}

/**
 * A toolbar island that expands downward from a compact strip, or leftward and downward from a
 * compact button. It is laid out at the largest size it passes through while it animates, and
 * only how much of it shows changes per frame (`writeMaterialReveal`), so no frame relayouts the
 * island or rebuilds its glass. The island supplies its own size, so its rim is redrawn in the same
 * frame as a size change. Render it at `size`. Sleep, a click elsewhere and Escape collapse it.
 */
export function useIslandReveal({
  surfaceRef,
  width,
  compactWidth = width,
  compactHeight,
  expandedHeight,
  staysOpen = false,
  holdOpen = false,
  toggleSelector,
}: IslandRevealOptions) {
  const [expanded, setExpanded] = useState(false);
  const target: MaterialSize = expanded
    ? { width, height: expandedHeight }
    : { width: compactWidth, height: compactHeight };
  const [layout, setLayout] = useState<MaterialSize>(target);
  // Grows at once, so a larger target is laid out before its first frame; shrinks only after
  // the animation down to it has finished.
  if (layout.width < target.width || layout.height < target.height) {
    setLayout({
      width: Math.max(layout.width, target.width),
      height: Math.max(layout.height, target.height),
    });
  }
  const shownRef = useRef<MaterialSize>(target);
  const scheduler = useMotionFrameScheduler();
  const reducedMotion = useReducedMotion();
  const asleep = useChromeAsleep();

  useEffect(() => {
    if (!asleep) return;
    const timer = window.setTimeout(() => setExpanded(false), SLEEP_FLIGHT_MS);
    return () => window.clearTimeout(timer);
  }, [asleep]);

  useEffect(() => {
    if (!expanded || holdOpen || staysOpen) return;
    const collapseOutside = (event: PointerEvent) => {
      const element = event.target as Element;
      if (surfaceRef.current?.contains(element)) return;
      if (toggleSelector && element.closest?.(toggleSelector)) return;
      setExpanded(false);
    };
    const collapseOnEscape = (event: KeyboardEvent) => {
      // A menu that just closed on this Escape has already claimed it.
      if (event.key === "Escape" && !event.defaultPrevented) setExpanded(false);
    };
    window.addEventListener("pointerdown", collapseOutside, true);
    window.addEventListener("keydown", collapseOnEscape);
    return () => {
      window.removeEventListener("pointerdown", collapseOutside, true);
      window.removeEventListener("keydown", collapseOnEscape);
    };
  }, [expanded, holdOpen, staysOpen, surfaceRef, toggleSelector]);

  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    if (surface) supplyMaterialSurfaceSize(surface, layout)?.();
  }, [layout, surfaceRef]);

  const targetWidth = target.width;
  const targetHeight = target.height;
  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const reveal = (shown: MaterialSize) =>
      writeMaterialReveal(
        surface,
        shown.height,
        layout.height,
        compactWidth === width ? undefined : { visible: shown.width, full: layout.width },
      );
    const from = shownRef.current;
    const to = { width: targetWidth, height: targetHeight };
    const settle = () => {
      shownRef.current = to;
      reveal(to);
      if (layout.width !== to.width || layout.height !== to.height) setLayout(to);
    };
    if (from.width === to.width && from.height === to.height) {
      settle();
      return;
    }
    const motion = to.height > from.height || to.width > from.width ? EXPAND : COLLAPSE;
    const toggling = to.height === compactHeight || from.height === compactHeight;
    const share = Math.min(
      1,
      Math.max(
        Math.abs(to.height - from.height) / Math.max(1, expandedHeight - compactHeight),
        Math.abs(to.width - from.width) / Math.max(1, width - compactWidth),
        toggling ? 0 : MIN_RESIZE_SHARE,
      ),
    );
    const durationMs = reducedMotion ? 0 : motion.durationMs * share;
    reveal(from);
    let elapsedMs = 0;
    return scheduler.subscribe(({ deltaMs }) => {
      elapsedMs += deltaMs;
      const progress = durationMs === 0 ? 1 : Math.min(1, elapsedMs / durationMs);
      const eased = motion.easing(progress);
      shownRef.current = {
        width: from.width + (to.width - from.width) * eased,
        height: from.height + (to.height - from.height) * eased,
      };
      if (progress < 1) {
        reveal(shownRef.current);
        return true;
      }
      settle();
      return false;
    });
  }, [
    compactHeight,
    compactWidth,
    expandedHeight,
    layout,
    reducedMotion,
    scheduler,
    surfaceRef,
    targetHeight,
    targetWidth,
    width,
  ]);

  const expand = useCallback(() => setExpanded(true), []);
  const collapse = useCallback(() => setExpanded(false), []);

  return {
    expanded,
    /** Laid out larger than compact: expanded, or still animating. */
    tall: layout.height > compactHeight || layout.width > compactWidth,
    /** The size to lay the island out at. */
    size: layout,
    expand,
    collapse,
  };
}
