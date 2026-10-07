import { useEffect, useMemo, useRef, useState } from "react";

export type LeftPanel = "canvases" | "extensions";
/** What the left side shows, ignoring a panel that is already closing. */
export type LeftPanelState = LeftPanel | "closed";

interface PanelPresence {
  readonly panel: LeftPanel | null;
  /** The panel is playing its exit and unmounts afterwards. */
  readonly closing: boolean;
}

const CLOSED: PanelPresence = { panel: null, closing: false };

/**
 * The left side panel: the Canvas Browser or the Extensions panel, never both. Switching is
 * instant; closing plays the panel's exit for `exitMs` before it unmounts.
 */
export function useLeftPanel(exitMs: number) {
  const [presence, setPresence] = useState<PanelPresence>(CLOSED);
  const latest = useRef(presence);
  latest.current = presence;
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitMsRef = useRef(exitMs);
  exitMsRef.current = exitMs;
  useEffect(
    () => () => {
      if (exitTimer.current !== null) clearTimeout(exitTimer.current);
    },
    [],
  );

  const actions = useMemo(() => {
    const cancelExit = () => {
      if (exitTimer.current !== null) clearTimeout(exitTimer.current);
      exitTimer.current = null;
    };
    const set = (next: PanelPresence) => {
      latest.current = next;
      setPresence(next);
    };
    const show = (panel: LeftPanel) => {
      cancelExit();
      set({ panel, closing: false });
    };
    const close = (panel: LeftPanel) => {
      const { panel: shown, closing } = latest.current;
      if (shown !== panel || closing) return;
      cancelExit();
      set({ panel, closing: true });
      exitTimer.current = setTimeout(() => {
        exitTimer.current = null;
        set(CLOSED);
      }, exitMsRef.current);
    };
    const current = (): LeftPanelState => {
      const { panel, closing } = latest.current;
      return panel && !closing ? panel : "closed";
    };
    /** Returns to a state remembered earlier, e.g. after cycling canvases with Ctrl+Tab. */
    const restore = (state: LeftPanelState) => {
      if (state !== "closed") show(state);
      else if (latest.current.panel === "canvases") close("canvases");
      else {
        cancelExit();
        set(CLOSED);
      }
    };
    /** Closes the panel when it is showing, otherwise shows it in place of the other one. */
    const toggle = (panel: LeftPanel) => {
      if (current() === panel) close(panel);
      else show(panel);
    };
    return { show, close, current, restore, toggle };
  }, []);

  return useMemo(
    () => ({
      canvasManagerOpen: presence.panel === "canvases",
      canvasManagerClosing: presence.panel === "canvases" && presence.closing,
      extensionsOpen: presence.panel === "extensions",
      extensionsClosing: presence.panel === "extensions" && presence.closing,
      ...actions,
    }),
    [actions, presence],
  );
}
