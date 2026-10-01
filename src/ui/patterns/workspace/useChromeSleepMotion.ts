import { useLayoutEffect, useRef, type RefObject } from "react";
import { markMaterialPresenceContent } from "../../materials/materialPresence";
import { useMotionFrameScheduler } from "../../motion/MotionProvider";
import { useReducedMotion } from "../../motion/reducedMotionPreference";
import {
  createPresenceMotion,
  type PresenceChannels,
  type PresenceMotion,
} from "../../motion/presenceMotion";
import { useChromeAsleep } from "./chromeSleep";
import { WORKSPACE_SIDE_PANEL_OFFSCREEN_MARGIN_PX } from "./useWorkspaceSidePanelMotion";
import { useWorkspaceIntroPhase } from "./workspaceIntro";

/** The window corner a chrome surface flies out to and back in from. */
export type ChromeSleepCorner = "top-left" | "top-right";

/** Same duration and ease-in-out as the side panel's slide (user direction 2026-10-01). */
const easeInOutCubic = (progress: number) =>
  progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
const TIMING = { durationMs: 300, easing: easeInOutCubic };

/** Distances from the anchoring window edges, so a resize while asleep still flies in correctly. */
interface CornerDistances {
  readonly outward: number;
  readonly upward: number;
}

/**
 * Sleep mode presence: the surface flies diagonally out past its window corner while its glass and
 * content fade, and flies back in to its spot on wake. Glass follows through the presence
 * controller (shared-plane shapes included), never ancestor opacity (glass contract section 17).
 * Hidden surfaces are inert.
 */
export function useChromeSleepMotion(
  surfaceRef: RefObject<HTMLElement | null>,
  corner: ChromeSleepCorner,
  { intro = false }: { readonly intro?: boolean } = {},
): void {
  // Workspace chrome also waits out the unlock reveal and then flies in like waking from sleep (and
  // flies out when locking);
  // the window controls (`intro: false`) are already on screen over the unlock panel.
  const introPhase = useWorkspaceIntroPhase();
  const introHidden =
    intro && (introPhase === "covered" || introPhase === "revealing" || introPhase === "departing");
  const asleep = useChromeAsleep() || introHidden;
  const scheduler = useMotionFrameScheduler();
  const reducedMotion = useReducedMotion();
  const motionRef = useRef<PresenceMotion | null>(null);
  const distancesRef = useRef<CornerDistances | null>(null);

  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const motion = createPresenceMotion(surface, {
      scheduler,
      reducedMotion,
      channels: { materialFade: true },
      enter: TIMING,
      exit: TIMING,
    });
    motionRef.current = motion;
    return () => {
      motion.destroy();
      motionRef.current = null;
    };
  }, [reducedMotion, scheduler, surfaceRef]);

  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    const motion = motionRef.current;
    if (!surface || !motion) return;
    if (asleep) {
      // Measured at rest, before flying out; reused for the flight back in.
      distancesRef.current = cornerDistances(surface, corner);
      markMaterialPresenceContent(surface);
    }
    motion.setChannels(sleepChannels(distancesRef.current, corner));
    // Mounted under the unlock screen: start out of view instead of flying out behind it.
    if (introPhase === "covered") motion.setProgress(0);
    else if (asleep) motion.hide();
    else motion.show();
    // introPhase only selects instant hiding; `asleep` already reflects every phase change that moves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asleep, corner, surfaceRef]);
}

function cornerDistances(surface: HTMLElement, corner: ChromeSleepCorner): CornerDistances {
  const rectangle = surface.getBoundingClientRect();
  const margin = WORKSPACE_SIDE_PANEL_OFFSCREEN_MARGIN_PX;
  return {
    outward:
      (corner === "top-left" ? rectangle.right : window.innerWidth - rectangle.left) + margin,
    upward: rectangle.bottom + margin,
  };
}

function sleepChannels(
  distances: CornerDistances | null,
  corner: ChromeSleepCorner,
): PresenceChannels {
  if (!distances) return { materialFade: true };
  const x = corner === "top-left" ? -distances.outward : distances.outward;
  return { materialFade: true, slide: { x, y: -distances.upward } };
}
