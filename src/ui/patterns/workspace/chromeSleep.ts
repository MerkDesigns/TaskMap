import { useEffect, useRef, useSyncExternalStore } from "react";

/** Sleep mode: default idle time before the chrome fades out (Settings can change it). */
export const CHROME_SLEEP_IDLE_MS = 3000;

/** Open overlays keep the chrome awake: hiding the controls under them would be disorienting. */
const KEEP_AWAKE_OVERLAYS =
  '[role="dialog"], [data-context-menu], .taskmap-quick-extensions-menu, .taskmap-color-picker';
/** Hovered chrome stays awake so it never vanishes under a resting pointer. */
const HOVERED_CHROME =
  ".taskmap-floating-canvas-toolbar:hover, .taskmap-window-controls:hover, .taskmap-workspace-side-panel:hover";
const ACTIVITY_EVENTS = ["pointermove", "pointerdown", "keydown", "wheel"] as const;

// Shared asleep/awake state. The workspace (App) decides; the toolbar islands and the app-level
// window controls only read it, so pointer movement never re-renders the workspace.
let asleep = false;
const listeners = new Set<() => void>();

function setChromeAsleep(next: boolean): void {
  if (asleep === next) return;
  asleep = next;
  listeners.forEach((listener) => listener());
}

export function useChromeAsleep(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => asleep,
    () => false,
  );
}

/**
 * Puts the workspace chrome to sleep after `idleMs` without input and wakes it on
 * any pointer movement, press, key or wheel inside the window. Activity only records a timestamp;
 * the single idle timer re-arms itself, so high-rate pointer events cost almost nothing.
 */
export function useChromeAutoHide(
  enabled: boolean,
  onSleep: () => void,
  onWake: () => void = () => {},
  idleMs: number = CHROME_SLEEP_IDLE_MS,
): void {
  const onSleepRef = useRef(onSleep);
  onSleepRef.current = onSleep;
  const onWakeRef = useRef(onWake);
  onWakeRef.current = onWake;

  useEffect(() => {
    if (!enabled) {
      setChromeAsleep(false);
      return;
    }
    let lastActivity = performance.now();
    let pressed = false;
    let timer = 0;
    const keepAwake = () =>
      pressed ||
      document.querySelector(KEEP_AWAKE_OVERLAYS) !== null ||
      document.querySelector(HOVERED_CHROME) !== null;
    const arm = (delay: number) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(check, Math.max(0, delay));
    };
    const check = () => {
      const idle = performance.now() - lastActivity;
      if (idle < idleMs) return arm(idleMs - idle);
      if (keepAwake()) {
        lastActivity = performance.now();
        return arm(idleMs);
      }
      setChromeAsleep(true);
      onSleepRef.current();
    };
    const activity = (event: Event) => {
      if (event.type === "pointerdown") pressed = true;
      lastActivity = performance.now();
      if (asleep) {
        setChromeAsleep(false);
        onWakeRef.current();
        arm(idleMs);
      }
    };
    const release = () => {
      pressed = false;
      lastActivity = performance.now();
    };
    ACTIVITY_EVENTS.forEach((type) =>
      window.addEventListener(type, activity, { capture: true, passive: true }),
    );
    window.addEventListener("pointerup", release, true);
    window.addEventListener("pointercancel", release, true);
    arm(idleMs);
    return () => {
      window.clearTimeout(timer);
      ACTIVITY_EVENTS.forEach((type) => window.removeEventListener(type, activity, true));
      window.removeEventListener("pointerup", release, true);
      window.removeEventListener("pointercancel", release, true);
      setChromeAsleep(false);
    };
  }, [enabled, idleMs]);
}
