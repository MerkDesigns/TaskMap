import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ToastMessage } from "../types";

/** The toast exit (240 ms, see ToastStack) with a frame of slack. */
const EXIT_MS = 260;
const DEFAULT_DURATION_MS = 4800;
const MAX_TOASTS = 4;

export type ToastRequest = Omit<ToastMessage, "id" | "exiting"> & { duration?: number };

/**
 * The toasts ToastStack shows, newest first: at most four, each dismissed after its duration
 * (or on demand) and kept for its exit animation before it is removed.
 */
export function useToastQueue() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => clearTimeout(timer));
  }, []);
  const later = useCallback((run: () => void, delayMs: number) => {
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      run();
    }, delayMs);
    timers.current.add(timer);
  }, []);

  const dismissToast = useCallback(
    (id: string) => {
      setToasts((current) =>
        current.map((toast) => (toast.id === id ? { ...toast, exiting: true } : toast)),
      );
      later(() => setToasts((current) => current.filter((toast) => toast.id !== id)), EXIT_MS);
    },
    [later],
  );

  const showToast = useCallback(
    ({ duration = DEFAULT_DURATION_MS, ...toast }: ToastRequest) => {
      const id = `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      setToasts((current) => [{ ...toast, id, exiting: false }, ...current].slice(0, MAX_TOASTS));
      later(() => dismissToast(id), duration);
    },
    [dismissToast, later],
  );

  return useMemo(() => ({ toasts, showToast, dismissToast }), [dismissToast, showToast, toasts]);
}
