import { useEffect, useLayoutEffect, useState, type RefObject } from "react";
import { markMaterialPresenceContent } from "../../ui/materials/materialPresence";
import { useMotionFrameScheduler } from "../../ui/motion/MotionProvider";
import { createPresenceMotion, easeOutCubic } from "../../ui/motion/presenceMotion";
import { useReducedMotion } from "../../ui/motion/reducedMotionPreference";
import {
  completeWorkspaceOutro,
  registerWorkspaceOutroPlayer,
  setWorkspaceIntroPhase,
  useWorkspaceIntroPhase,
  whenWorkspaceIntroCanvasMounted,
} from "../../ui/patterns/workspace/workspaceIntro";

// iPhone-style unlock: the panel lifts toward the viewer and dissolves while the dark backdrop
// clears and the canvas settles from a slight zoom; the chrome then arrives on its own motion.
const PANEL_EXIT = { durationMs: 380, easing: easeOutCubic };
const PANEL_EXIT_SCALE = 1.12;
const BACKDROP_FADE = { duration: 620, easing: "cubic-bezier(0.33, 1, 0.68, 1)" } as const;
/**
 * When the toolbars and Canvas Browser start, relative to the reveal: after the panel has nearly
 * faded, so the Canvas Browser's mount (a main-thread frame or two) only meets compositor-driven
 * motion (canvas settle, backdrop fade).
 */
const CHROME_ARRIVAL_MS = 260;
const REVEAL_COMPLETE_MS = 900;
/** Lets the freshly mounted workspace paint a frame or two before it is uncovered. */
const SETTLE_BEFORE_REVEAL_MS = 60;
/** Reveal anyway if no workspace canvas mounts (e.g. a failed lazy chunk shows its own error). */
const MOUNT_TIMEOUT_MS = 4000;

// Locking is the same motion in reverse: the backdrop darkens while the panel descends from the
// lifted scale and solidifies, timed with the canvas zooming in and the chrome leaving.
const BACKDROP_RETURN = {
  delay: 60,
  duration: 520,
  easing: "cubic-bezier(0.33, 0, 0.67, 1)",
  fill: "both",
} as const;
const PANEL_RETURN = { durationMs: 420, easing: easeOutCubic };
const PANEL_RETURN_DELAY_MS = 180;
/** When the session may lock: the cover has settled. */
const OUTRO_COMPLETE_MS = 650;

export type UnlockRevealState = "none" | "covering" | "revealing" | "concealing";

/**
 * Keeps the unlock screen over the freshly mounted workspace and plays the reveal. The panel fades
 * through the presence controller (material presence, never ancestor opacity, which would flatten
 * its glass); the backdrop is a sibling layer with its own opacity.
 */
export function useUnlockReveal(
  ready: boolean,
  panelRef: RefObject<HTMLElement | null>,
  backdropRef: RefObject<HTMLElement | null>,
  /** Reopened into a session that was already unlocked: the workspace appears without a reveal. */
  resumed = false,
): UnlockRevealState {
  const scheduler = useMotionFrameScheduler();
  const reducedMotion = useReducedMotion();
  // A session that is already ready on mount (e.g. a resumed one) is shown without a reveal.
  const [state, setState] = useState<UnlockRevealState>("none");
  const [seenReady, setSeenReady] = useState(ready);
  const [resumeArriving, setResumeArriving] = useState(false);
  // The render that first sees `ready` must already keep the unlock screen, or it would unmount
  // and remount around the workspace's first frame.
  const justReady = ready && !seenReady;
  // Lock animation: the unlock screen returns over the still-unlocked workspace; the session locks
  // when it has settled, and the same screen then simply stays.
  useLayoutEffect(() => registerWorkspaceOutroPlayer(), []);
  const introPhase = useWorkspaceIntroPhase();
  const concealing = ready && introPhase === "departing";

  useLayoutEffect(() => {
    if (!concealing) return;
    if (reducedMotion) {
      completeWorkspaceOutro();
      return;
    }
    const panel = panelRef.current;
    const backdrop = backdropRef.current;
    // Mounted this render: start hidden before the first paint, then settle in.
    let motion: ReturnType<typeof createPresenceMotion> | null = null;
    if (panel) {
      markMaterialPresenceContent(panel);
      motion = createPresenceMotion(panel, {
        scheduler,
        reducedMotion,
        channels: { materialFade: true, scale: PANEL_EXIT_SCALE },
        enter: PANEL_RETURN,
        initialProgress: 0,
      });
    }
    const fade = backdrop?.animate?.([{ opacity: 0 }, { opacity: 1 }], BACKDROP_RETURN);
    const show = window.setTimeout(() => motion?.show(), PANEL_RETURN_DELAY_MS);
    const complete = window.setTimeout(completeWorkspaceOutro, OUTRO_COMPLETE_MS);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(complete);
      motion?.destroy();
      fade?.cancel();
    };
  }, [backdropRef, concealing, panelRef, reducedMotion, scheduler]);

  useLayoutEffect(() => {
    if (ready === seenReady) return;
    setSeenReady(ready);
    if (!ready) {
      setState("none");
      setWorkspaceIntroPhase("idle");
      return;
    }
    if (resumed) {
      setResumeArriving(true);
      return;
    }
    if (reducedMotion) {
      setWorkspaceIntroPhase("arriving");
      setWorkspaceIntroPhase("idle");
      return;
    }
    setWorkspaceIntroPhase("covered");
    setState("covering");
  }, [ready, reducedMotion, resumed, seenReady]);

  // A resumed workspace arrives without a reveal, but like a revealed one only once its (lazily
  // loaded) canvas is mounted: its arrival listeners, e.g. opening the Canvas Browser, subscribe then.
  useEffect(() => {
    if (!resumeArriving) return;
    let frame = 0;
    let arrived = false;
    const arrive = () => {
      if (arrived) return;
      arrived = true;
      frame = requestAnimationFrame(() => {
        setWorkspaceIntroPhase("arriving");
        setWorkspaceIntroPhase("idle");
        setResumeArriving(false);
      });
    };
    const unsubscribe = whenWorkspaceIntroCanvasMounted(arrive);
    const timer = window.setTimeout(arrive, MOUNT_TIMEOUT_MS);
    return () => {
      unsubscribe();
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [resumeArriving]);

  useEffect(() => {
    if (state !== "covering") return;
    const timers: number[] = [];
    let frame = 0;
    let started = false;
    const reveal = () => {
      if (started) return;
      started = true;
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          timers.push(window.setTimeout(() => setState("revealing"), SETTLE_BEFORE_REVEAL_MS));
        });
      });
    };
    const unsubscribe = whenWorkspaceIntroCanvasMounted(reveal);
    timers.push(window.setTimeout(reveal, MOUNT_TIMEOUT_MS));
    return () => {
      unsubscribe();
      cancelAnimationFrame(frame);
      timers.forEach(window.clearTimeout);
    };
  }, [state]);

  useEffect(() => {
    if (state !== "revealing") return;
    const panel = panelRef.current;
    const backdrop = backdropRef.current;
    (document.activeElement as HTMLElement | null)?.blur?.();
    setWorkspaceIntroPhase("revealing");
    let motion: ReturnType<typeof createPresenceMotion> | null = null;
    // Anything that still renders into the panel mid-reveal must dissolve with it too.
    const contentObserver = panel
      ? new MutationObserver(() => markMaterialPresenceContent(panel))
      : null;
    if (panel) {
      contentObserver!.observe(panel, { childList: true, subtree: true });
      markMaterialPresenceContent(panel);
      motion = createPresenceMotion(panel, {
        scheduler,
        reducedMotion,
        channels: { materialFade: true, scale: PANEL_EXIT_SCALE },
        exit: PANEL_EXIT,
      });
      motion.hide();
    }
    // `animate` is missing only in test DOMs; the reveal still completes on its timers there.
    const fade = backdrop?.animate?.([{ opacity: 1 }, { opacity: 0 }], {
      ...BACKDROP_FADE,
      fill: "forwards",
    });
    const arrival = window.setTimeout(() => setWorkspaceIntroPhase("arriving"), CHROME_ARRIVAL_MS);
    const complete = window.setTimeout(() => {
      setWorkspaceIntroPhase("idle");
      setState("none");
    }, REVEAL_COMPLETE_MS);
    return () => {
      window.clearTimeout(arrival);
      window.clearTimeout(complete);
      contentObserver?.disconnect();
      motion?.destroy();
      fade?.cancel();
    };
  }, [backdropRef, panelRef, reducedMotion, scheduler, state]);

  useEffect(() => () => setWorkspaceIntroPhase("idle"), []);

  if (concealing) return "concealing";
  return justReady && state === "none" && !resumed ? "covering" : state;
}
