import { useLayoutEffect, useRef, type RefObject } from "react";
import { useMotionFrameScheduler } from "../../motion/MotionProvider";
import { useReducedMotion } from "../../motion/reducedMotionPreference";
import {
  createPresenceMotion,
  type PresenceChannels,
  type PresenceMotion,
} from "../../motion/presenceMotion";
import { presetChannels } from "../../motion/presencePresets";
import { usePresencePreset, type SurfacePresenceName } from "../../motion/usePresenceMotion";
import { refreshMaterialSurfaceBackdrop } from "../../materials/materialGeometryInvalidation";

/** Every side-panel preset keeps this duration; App's unmount timer depends on it. */
export const WORKSPACE_SIDE_PANEL_SLIDE_DURATION_MS = 300;
export const WORKSPACE_SIDE_PANEL_OFFSCREEN_MARGIN_PX = 32;
/** Scale while hidden for the default fade + slide + scale presence. */
const SIDE_PANEL_SCALE = 0.94;

/** Ease in and out in both directions. */
const easeInOutCubic = (progress: number) =>
  progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
const TIMING = { durationMs: WORKSPACE_SIDE_PANEL_SLIDE_DURATION_MS, easing: easeInOutCubic };

/**
 * Side-panel presence through the shared presence controller. The default fades the panel's glass
 * and content in from zero while sliding it in from off-screen and scaling it up; the workbench
 * previews alternatives.
 */
export function useWorkspaceSidePanelMotion(
  panelRef: RefObject<HTMLElement | null>,
  closing: boolean,
): void {
  const scheduler = useMotionFrameScheduler();
  const reducedMotion = useReducedMotion();
  const preset = usePresencePreset("sidePanel", "fadeScaleOffscreenSlide");
  const motionRef = useRef<PresenceMotion | null>(null);
  const presetRef = useRef(preset);
  presetRef.current = preset;

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const motion = createPresenceMotion(panel, {
      scheduler,
      reducedMotion,
      channels: sidePanelChannels(panel, presetRef.current),
      enter: TIMING,
      exit: TIMING,
      initialProgress: 0,
      onComplete: (endpoint) => {
        if (endpoint === "visible") refreshMaterialSurfaceBackdrop(panel);
      },
    });
    motionRef.current = motion;
    return () => {
      motion.destroy();
      motionRef.current = null;
    };
  }, [panelRef, reducedMotion, scheduler]);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    const motion = motionRef.current;
    if (!panel || !motion) return;
    motion.setChannels(sidePanelChannels(panel, preset));
    if (closing) motion.hide();
    else motion.show();
  }, [closing, panelRef, preset]);
}

function sidePanelChannels(panel: HTMLElement, preset: SurfacePresenceName): PresenceChannels {
  if (preset === "offscreenSlide") return { slide: { x: offscreenTranslateX(panel) } };
  if (preset === "fadeOffscreenSlide") {
    return { materialFade: true, slide: { x: offscreenTranslateX(panel) } };
  }
  if (preset === "fadeScaleOffscreenSlide") {
    return {
      materialFade: true,
      slide: { x: offscreenTranslateX(panel) },
      scale: SIDE_PANEL_SCALE,
    };
  }
  return presetChannels(preset, "materialFadeSlideLeft");
}

function offscreenTranslateX(panel: HTMLElement): number {
  // Layout width ignores presence transforms (e.g. a scale preset mid-animation).
  const width = panel.offsetWidth || panel.getBoundingClientRect().width || 288;
  const inlineInset = Number.parseFloat(
    window.getComputedStyle(panel).getPropertyValue("--taskmap-chrome-inset-inline"),
  );
  const left = Number.isFinite(inlineInset) ? inlineInset : 16;
  return -(width + left + WORKSPACE_SIDE_PANEL_OFFSCREEN_MARGIN_PX);
}
