import { useEffect, useState, useSyncExternalStore } from "react";

export type LeftPanel = "canvases" | "extensions";
/** What the left side shows, ignoring a panel that is already closing. */
export type LeftPanelState = LeftPanel | "closed";

interface PanelPresence {
  readonly panel: LeftPanel | null;
  /** The panel is playing its exit and unmounts afterwards. */
  readonly closing: boolean;
}

/** What the chrome renders for the left side. */
export interface LeftPanelPresence {
  readonly canvasManagerOpen: boolean;
  readonly canvasManagerClosing: boolean;
  readonly extensionsOpen: boolean;
  readonly extensionsClosing: boolean;
}

export interface LeftPanelController {
  show(panel: LeftPanel): void;
  close(panel: LeftPanel): void;
  current(): LeftPanelState;
  /** Returns to a state remembered earlier, e.g. after cycling canvases with Ctrl+Tab. */
  restore(state: LeftPanelState): void;
  /** Closes the panel when it is showing, otherwise shows it in place of the other one. */
  toggle(panel: LeftPanel): void;
  subscribe(listener: () => void): () => void;
  getPresence(): LeftPanelPresence;
}

const CLOSED: PanelPresence = { panel: null, closing: false };

/**
 * The left side panel: the Canvas Browser or the Extensions panel, never both. Switching is
 * instant; closing plays the panel's exit for `exitMs` before it unmounts.
 *
 * The controller keeps a stable identity and holds the presence outside React state, so toggling
 * the panel re-renders only the components that read it through `useLeftPanelPresence`, not the
 * component that owns the controller.
 */
export function useLeftPanel(exitMs: number): LeftPanelController {
  const [controller] = useState(() => createLeftPanelController(exitMs));
  controller.setExitMs(exitMs);
  useEffect(() => controller.dispose, [controller]);
  return controller;
}

export function useLeftPanelPresence(controller: LeftPanelController): LeftPanelPresence {
  return useSyncExternalStore(controller.subscribe, controller.getPresence);
}

function createLeftPanelController(initialExitMs: number) {
  let presence = CLOSED;
  let snapshot = presenceSnapshot(presence);
  let exitMs = initialExitMs;
  let exitTimer: ReturnType<typeof setTimeout> | null = null;
  const listeners = new Set<() => void>();

  const cancelExit = () => {
    if (exitTimer !== null) clearTimeout(exitTimer);
    exitTimer = null;
  };
  const set = (next: PanelPresence) => {
    if (next.panel === presence.panel && next.closing === presence.closing) return;
    presence = next;
    snapshot = presenceSnapshot(next);
    listeners.forEach((listener) => listener());
  };
  const show = (panel: LeftPanel) => {
    cancelExit();
    set({ panel, closing: false });
  };
  const close = (panel: LeftPanel) => {
    if (presence.panel !== panel || presence.closing) return;
    cancelExit();
    set({ panel, closing: true });
    exitTimer = setTimeout(() => {
      exitTimer = null;
      set(CLOSED);
    }, exitMs);
  };
  const current = (): LeftPanelState =>
    presence.panel && !presence.closing ? presence.panel : "closed";

  return {
    show,
    close,
    current,
    restore(state: LeftPanelState) {
      if (state !== "closed") show(state);
      else if (presence.panel === "canvases") close("canvases");
      else {
        cancelExit();
        set(CLOSED);
      }
    },
    toggle(panel: LeftPanel) {
      if (current() === panel) close(panel);
      else show(panel);
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getPresence: () => snapshot,
    setExitMs(next: number) {
      exitMs = next;
    },
    dispose: cancelExit,
  };
}

function presenceSnapshot({ panel, closing }: PanelPresence): LeftPanelPresence {
  return {
    canvasManagerOpen: panel === "canvases",
    canvasManagerClosing: panel === "canvases" && closing,
    extensionsOpen: panel === "extensions",
    extensionsClosing: panel === "extensions" && closing,
  };
}
