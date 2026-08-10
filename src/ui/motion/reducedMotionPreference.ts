import {
  createContext,
  createElement,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export interface ReducedMotionPreference {
  getSnapshot(): boolean;
  subscribe(listener: () => void): () => void;
}

interface MediaQueryListLike {
  readonly matches: boolean;
  addEventListener(type: "change", listener: () => void): void;
  removeEventListener(type: "change", listener: () => void): void;
}

export function createReducedMotionPreference(
  createQuery: (() => MediaQueryListLike) | null,
): ReducedMotionPreference {
  let query: MediaQueryListLike | null = null;
  const requireQuery = () => (query ??= createQuery?.() ?? null);
  return Object.freeze({
    getSnapshot: () => requireQuery()?.matches ?? false,
    subscribe(listener: () => void) {
      const current = requireQuery();
      if (!current) return () => undefined;
      current.addEventListener("change", listener);
      return () => current.removeEventListener("change", listener);
    },
  });
}

const browserPreference = createReducedMotionPreference(
  typeof window === "undefined" || typeof window.matchMedia !== "function"
    ? null
    : () => window.matchMedia("(prefers-reduced-motion: reduce)"),
);

const ReducedMotionOverrideContext = createContext<boolean | null>(null);

export interface ReducedMotionProviderProps {
  readonly children: ReactNode;
  readonly override: boolean | null;
}

export function ReducedMotionProvider({ children, override }: ReducedMotionProviderProps) {
  return createElement(ReducedMotionOverrideContext.Provider, { value: override }, children);
}

export function useSystemReducedMotion(): boolean {
  return useSyncExternalStore(
    browserPreference.subscribe,
    browserPreference.getSnapshot,
    () => false,
  );
}

export function useReducedMotion(): boolean {
  const systemPreference = useSystemReducedMotion();
  return useContext(ReducedMotionOverrideContext) ?? systemPreference;
}
