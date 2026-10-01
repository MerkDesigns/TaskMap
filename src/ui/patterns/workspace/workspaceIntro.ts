import { useEffect, useRef, useSyncExternalStore } from "react";

/**
 * The unlock reveal (iPhone-style), shared by the database entry and the workspace it uncovers:
 * - `covered`: the workspace is mounted under the unlock screen; canvas zoomed, chrome hidden.
 * - `revealing`: the unlock panel scales up and fades, the dark backdrop fades, the canvas settles.
 * - `arriving`: the toolbars and the Canvas Browser play their own appear animations.
 * - `idle`: no reveal; every surface is at rest.
 * - `departing`: the lock in reverse — chrome leaves, the canvas zooms in and the unlock screen
 *   settles over it; the session locks once that has played.
 */
export type WorkspaceIntroPhase = "idle" | "covered" | "revealing" | "arriving" | "departing";

let phase: WorkspaceIntroPhase = "idle";
// Mounted canvas layers. The workspace can mount after the session is ready (lazy development
// workbench), so the reveal waits for it instead of uncovering an empty window.
let mountedCanvasLayers = 0;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

export function setWorkspaceIntroPhase(next: WorkspaceIntroPhase): void {
  if (phase === next) return;
  phase = next;
  notify();
}

// Resolves the pending lock animation; the database entry calls it when its cover has settled.
let finishOutro: (() => void) | null = null;
// Mounted surfaces able to play the lock animation (the database entry).
let outroPlayers = 0;
/** Resolves even if the player never finishes (e.g. it unmounts mid-animation). */
const OUTRO_FALLBACK_MS = 1500;

/** Registers a surface that plays the lock animation while it is mounted. */
export function registerWorkspaceOutroPlayer(): () => void {
  outroPlayers += 1;
  return () => {
    outroPlayers -= 1;
  };
}

/** Plays the lock animation; resolves when the workspace is covered and may be locked. */
export function beginWorkspaceOutro(): Promise<void> {
  finishOutro?.();
  if (outroPlayers === 0) return Promise.resolve();
  return new Promise((resolve) => {
    const finish = () => {
      if (finishOutro !== finish) return;
      finishOutro = null;
      window.clearTimeout(fallback);
      resolve();
    };
    const fallback = window.setTimeout(finish, OUTRO_FALLBACK_MS);
    finishOutro = finish;
    setWorkspaceIntroPhase("departing");
  });
}

export function completeWorkspaceOutro(): void {
  finishOutro?.();
}

/** The lock did not happen (e.g. a save failed): uncover the still-unlocked workspace. */
export function cancelWorkspaceOutro(): void {
  finishOutro?.();
  setWorkspaceIntroPhase("idle");
}

/** Called by the workspace's canvas layer while it is mounted. */
export function registerWorkspaceIntroCanvas(): () => void {
  mountedCanvasLayers += 1;
  notify();
  return () => {
    mountedCanvasLayers -= 1;
    notify();
  };
}

/** Calls `onMounted` once a workspace canvas layer is mounted (immediately if one already is). */
export function whenWorkspaceIntroCanvasMounted(onMounted: () => void): () => void {
  if (mountedCanvasLayers > 0) {
    onMounted();
    return () => {};
  }
  const unsubscribe = subscribe(() => {
    if (mountedCanvasLayers === 0) return;
    unsubscribe();
    onMounted();
  });
  return unsubscribe;
}

export function getWorkspaceIntroPhase(): WorkspaceIntroPhase {
  return phase;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useWorkspaceIntroPhase(): WorkspaceIntroPhase {
  return useSyncExternalStore(subscribe, getWorkspaceIntroPhase, () => "idle" as const);
}

function useWorkspaceIntroEntering(target: WorkspaceIntroPhase, onEnter: () => void): void {
  const callback = useRef(onEnter);
  callback.current = onEnter;
  useEffect(() => {
    let previous = getWorkspaceIntroPhase();
    return subscribe(() => {
      const next = getWorkspaceIntroPhase();
      if (next === target && previous !== target) callback.current();
      previous = next;
    });
  }, [target]);
}

/** Runs `onArrive` when a reveal reaches its chrome stage (e.g. to open the Canvas Browser). */
export function useWorkspaceIntroArrival(onArrive: () => void): void {
  useWorkspaceIntroEntering("arriving", onArrive);
}

/** Runs `onDepart` when the lock animation starts (e.g. to close the side panel). */
export function useWorkspaceIntroDeparture(onDepart: () => void): void {
  useWorkspaceIntroEntering("departing", onDepart);
}
