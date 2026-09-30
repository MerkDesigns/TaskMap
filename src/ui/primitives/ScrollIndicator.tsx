import { useLayoutEffect, useRef, type HTMLAttributes, type RefObject } from "react";
import { primitiveClassNames } from "./primitiveClassNames";
import "./scrollIndicator.css";

export interface ScrollIndicatorProps extends HTMLAttributes<HTMLDivElement> {
  /** The element whose vertical scroll position the indicator reflects. */
  readonly targetRef: RefObject<HTMLElement | null>;
}

const MIN_THUMB_PX = 14;
const ACTIVE_MS = 700;

/**
 * Small decorative scroll affordance for lists whose native scrollbar is hidden. The consumer
 * positions it (usually absolutely beside the list). Scroll frames only move the thumb with a
 * transform; sizes are re-read when the target resizes or its content changes.
 */
export function ScrollIndicator({ className, targetRef, ...props }: ScrollIndicatorProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const target = targetRef.current;
    const track = trackRef.current;
    const thumb = thumbRef.current;
    if (!target || !track || !thumb) return;
    let range = 0;
    let travel = 0;
    let activeTimer: number | undefined;
    const position = () => {
      if (range <= 0) return;
      const progress = Math.min(1, Math.max(0, target.scrollTop / range));
      thumb.style.transform = `translate3d(0, ${travel * progress}px, 0)`;
    };
    const measure = () => {
      range = target.scrollHeight - target.clientHeight;
      const scrollable = range > 1;
      track.dataset.hidden = String(!scrollable);
      if (!scrollable) return;
      const trackHeight = track.clientHeight;
      const thumbHeight = Math.max(
        MIN_THUMB_PX,
        Math.round((trackHeight * target.clientHeight) / target.scrollHeight),
      );
      travel = Math.max(0, trackHeight - thumbHeight);
      thumb.style.height = `${thumbHeight}px`;
      position();
    };
    const handleScroll = () => {
      position();
      track.dataset.active = "true";
      window.clearTimeout(activeTimer);
      activeTimer = window.setTimeout(() => delete track.dataset.active, ACTIVE_MS);
    };
    measure();
    target.addEventListener("scroll", handleScroll, { passive: true });
    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    resizeObserver?.observe(target);
    resizeObserver?.observe(track);
    const mutationObserver = new MutationObserver(measure);
    mutationObserver.observe(target, { childList: true, subtree: true });
    return () => {
      target.removeEventListener("scroll", handleScroll);
      resizeObserver?.disconnect();
      mutationObserver.disconnect();
      window.clearTimeout(activeTimer);
    };
  }, [targetRef]);

  return (
    <div
      {...props}
      ref={trackRef}
      aria-hidden="true"
      data-hidden="true"
      className={primitiveClassNames("taskmap-scroll-indicator", className)}
    >
      <div ref={thumbRef} className="taskmap-scroll-indicator__thumb" />
    </div>
  );
}
