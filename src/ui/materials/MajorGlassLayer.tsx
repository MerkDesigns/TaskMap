import { createContext, useSyncExternalStore } from "react";

export interface MajorGlassLayerOwner {
  register(element: HTMLElement, radius: number): () => void;
}

/** MaterialSurface registration stays independent from the concrete plane renderer. */
export const MajorGlassLayerContext = createContext<MajorGlassLayerOwner | null>(null);

// Mounted workspace planes, most recent last. Base Majors rendered outside the workspace subtree
// (the app-level window chrome portal) join the active plane through this store.
const publishedOwners: MajorGlassLayerOwner[] = [];
const listeners = new Set<() => void>();
const activeOwner = () => publishedOwners[publishedOwners.length - 1] ?? null;

export function publishWorkspaceMajorOwner(owner: MajorGlassLayerOwner): () => void {
  publishedOwners.push(owner);
  listeners.forEach((listener) => listener());
  return () => {
    const index = publishedOwners.lastIndexOf(owner);
    if (index >= 0) publishedOwners.splice(index, 1);
    listeners.forEach((listener) => listener());
  };
}

export function useWorkspaceMajorOwner(): MajorGlassLayerOwner | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    activeOwner,
    () => null,
  );
}
