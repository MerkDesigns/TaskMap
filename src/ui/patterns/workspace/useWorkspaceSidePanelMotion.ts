import { useCallback, useLayoutEffect, useRef, type RefObject } from "react";
import { useMotionFrameScheduler } from "../../motion/MotionProvider";
import type { MotionFrameScheduler } from "../../motion/motionFrameScheduler";
import { interpolate, normalizedProgress } from "../../motion/motionMath";
import { useReducedMotion } from "../../motion/reducedMotionPreference";
import { invalidateChromeGlassBatch, LEFT_CHROME_GLASS_BATCH } from "./WorkspaceChromeGlassBatches";

export const WORKSPACE_SIDE_PANEL_SLIDE_DURATION_MS = 240;
export const WORKSPACE_SIDE_PANEL_OFFSCREEN_MARGIN_PX = 32;

type SlidePhase = "active" | "hidden" | "rest";

export function useWorkspaceSidePanelMotion(
  panelRef: RefObject<HTMLElement | null>,
  closing: boolean,
): void {
  const scheduler = useMotionFrameScheduler();
  const reducedMotion = useReducedMotion();
  const translateXRef = useRef(0);
  const initializedRef = useRef(false);

  const writePanel = useCallback(
    (translateX: number, phase: SlidePhase) => {
      translateXRef.current = translateX;
      const panel = panelRef.current;
      if (!panel) return;

      if (phase === "rest") {
        delete panel.dataset.panelMotion;
        panel.style.transform = "";
        panel.style.willChange = "";
      } else {
        panel.dataset.panelMotion = phase;
        panel.style.transform = `translate3d(${translateX}px, 0, 0)`;
        panel.style.willChange = phase === "active" ? "transform" : "";
      }
      invalidateChromeGlassBatch(LEFT_CHROME_GLASS_BATCH);
    },
    [panelRef],
  );

  useLayoutEffect(() => {
    const opening = !closing;
    const offscreenX = getOffscreenTranslateX(panelRef.current);
    const from = initializedRef.current ? translateXRef.current : opening ? offscreenX : 0;
    const target = opening ? 0 : offscreenX;
    initializedRef.current = true;

    if (reducedMotion || from === target) {
      writePanel(target, opening ? "rest" : "hidden");
      return;
    }

    return subscribeSlideAnimation(scheduler, writePanel, from, target, opening);
  }, [closing, panelRef, reducedMotion, scheduler, writePanel]);

  useLayoutEffect(() => () => invalidateChromeGlassBatch(LEFT_CHROME_GLASS_BATCH), []);
}

function subscribeSlideAnimation(
  scheduler: MotionFrameScheduler,
  writePanel: (translateX: number, phase: SlidePhase) => void,
  from: number,
  target: number,
  opening: boolean,
): () => void {
  let elapsedMs = 0;
  writePanel(from, "active");
  return scheduler.subscribe(({ deltaMs }) => {
    elapsedMs += deltaMs;
    const progress = normalizedProgress(elapsedMs, 0, WORKSPACE_SIDE_PANEL_SLIDE_DURATION_MS);
    const easedProgress = opening ? easeInCubic(progress) : easeOutCubic(progress);
    writePanel(interpolate(from, target, easedProgress), "active");
    if (progress < 1) return true;
    writePanel(target, opening ? "rest" : "hidden");
    return false;
  });
}

function getOffscreenTranslateX(panel: HTMLElement | null): number {
  if (!panel) return 0;
  const width = panel.getBoundingClientRect().width || panel.offsetWidth || 288;
  const inlineInset = Number.parseFloat(
    window.getComputedStyle(panel).getPropertyValue("--taskmap-chrome-inset-inline"),
  );
  const left = Number.isFinite(inlineInset) ? inlineInset : 16;
  return -(width + left + WORKSPACE_SIDE_PANEL_OFFSCREEN_MARGIN_PX);
}

function easeInCubic(progress: number): number {
  return progress * progress * progress;
}

function easeOutCubic(progress: number): number {
  return 1 - Math.pow(1 - progress, 3);
}
