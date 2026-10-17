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

/** Where a chrome surface flies out to and back in from: a window corner, or straight up. */
export type ChromeSleepCorner = "top-left" | "top-right" | "top";

/** Same duration and ease-in-out as the side panel's slide. */
const easeInOutCubic = (progress: number) =>
  progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
const TIMING = { durationMs: 300, easing: easeInOutCubic };

export interface ChromeSleepMotionOptions {
  /** Also hidden under the unlock reveal, flying in after it. */
  readonly intro?: boolean;
  /**
   * For a surface its owner shows and hides: it flies in when mounted and out when this turns
   * true, along the same path as sleep and through the same presence owner.
   */
  readonly hidden?: boolean;
  /** Called once a `hidden` surface has finished going, so the owner can unmount it. */
  readonly onHidden?: () => void;
}

/** Distances from the anchoring window edges, so a resize while asleep still flies in correctly. */
interface CornerDistances {
  readonly outward: number;
  readonly upward: number;
}

/**
 * Sleep mode presence: the surface flies diagonally out past its window corner while its glass and
 * content fade, and flies back in to its spot on wake. Glass follows through the presence
 * controller (shared-plane shapes included), never ancestor opacity.
 * Hidden surfaces are inert.
 */
export function useChromeSleepMotion(
  surfaceRef: RefObject<HTMLElement | null>,
  corner: ChromeSleepCorner,
  { intro = false, hidden, onHidden }: ChromeSleepMotionOptions = {},
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
  const ownerHidden = hidden === true;
  // A toggled surface mounts out of view and its first entrance is the toggle slide, not a flight.
  const toggled = useRef(hidden !== undefined).current;
  const enteredRef = useRef(!toggled);
  const ownerHiddenRef = useRef(ownerHidden);
  ownerHiddenRef.current = ownerHidden;
  const onHiddenRef = useRef(onHidden);
  onHiddenRef.current = onHidden;

  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const motion = createPresenceMotion(surface, {
      scheduler,
      reducedMotion,
      channels: { materialFade: true },
      enter: TIMING,
      exit: TIMING,
      initialProgress: toggled ? 0 : 1,
      onComplete: (endpoint) => {
        if (endpoint === "hidden" && ownerHiddenRef.current) onHiddenRef.current?.();
      },
    });
    motionRef.current = motion;
    return () => {
      motion.destroy();
      motionRef.current = null;
    };
  }, [reducedMotion, scheduler, surfaceRef, toggled]);

  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    const motion = motionRef.current;
    if (!surface || !motion) return;
    if (asleep || ownerHidden || !enteredRef.current) {
      // Measured at rest, before flying out; reused for the flight back in. A toggled surface's
      // first entrance is measured where it mounted, out of view but untransformed.
      distancesRef.current = cornerDistances(surface, corner);
      markMaterialPresenceContent(surface);
    }
    motion.setChannels(sleepChannels(distancesRef.current, corner));
    if (ownerHidden) {
      // Shown again before it unmounts, it flies back in the same way.
      enteredRef.current = false;
      motion.hide();
      return;
    }
    if (!asleep) enteredRef.current = true;
    // Mounted under the unlock screen: start out of view instead of flying out behind it.
    if (introPhase === "covered") motion.setProgress(0);
    else if (asleep) motion.hide();
    else motion.show();
    // introPhase only selects instant hiding; `asleep` already reflects every phase change that moves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asleep, corner, ownerHidden, surfaceRef]);
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
  const x = corner === "top" ? 0 : corner === "top-left" ? -distances.outward : distances.outward;
  return { materialFade: true, slide: { x, y: -distances.upward } };
}
