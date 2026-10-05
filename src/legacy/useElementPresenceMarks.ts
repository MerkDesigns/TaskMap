import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/** Element families the canvas animates separately. */
export interface ElementIdsByKind {
  readonly containers: readonly string[];
  readonly textCards: readonly string[];
  readonly textBlocks: readonly string[];
  readonly images: readonly string[];
}

type Kind = keyof ElementIdsByKind;
type PulseKind = "textCards" | "textBlocks";

const NONE: ElementIdsByKind = Object.freeze({
  containers: [],
  textCards: [],
  textBlocks: [],
  images: [],
});
/** Matches the CSS enter animations (170 ms) with a frame of slack. */
const ENTER_MS = 180;
/** Matches the save pulse (240 ms) with a frame of slack. */
const PULSE_MS = 260;

const without = (ids: readonly string[], id: string) => ids.filter((other) => other !== id);

/**
 * Which elements are playing their enter, delete or save-pulse animation. These are transient
 * presentation marks: the document never sees them, and timers clear enter and pulse marks once
 * their animation has played.
 */
export function useElementPresenceMarks() {
  const [entering, setEntering] = useState<ElementIdsByKind>(NONE);
  const [deleting, setDeleting] = useState<ElementIdsByKind>(NONE);
  const [pulsing, setPulsing] = useState<Pick<ElementIdsByKind, PulseKind>>(NONE);
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

  const actions = useMemo(
    () => ({
      animateIn(kind: Kind, id: string) {
        setEntering((current) => ({ ...current, [kind]: [...current[kind], id] }));
        later(
          () => setEntering((current) => ({ ...current, [kind]: without(current[kind], id) })),
          ENTER_MS,
        );
      },
      pulse(kind: PulseKind, id: string) {
        setPulsing((current) => ({ ...current, [kind]: [...without(current[kind], id), id] }));
        later(
          () => setPulsing((current) => ({ ...current, [kind]: without(current[kind], id) })),
          PULSE_MS,
        );
      },
      /** Marks the elements a deletion removes, until `clearDeleting`. */
      markDeleting(ids: ElementIdsByKind) {
        setDeleting(ids);
      },
      clearDeleting() {
        setDeleting(NONE);
      },
    }),
    [later],
  );

  return useMemo(
    () => ({ entering, deleting, pulsing, ...actions }),
    [actions, deleting, entering, pulsing],
  );
}
