import { useEffect, useMemo, useRef, useState } from "react";

/** Matches the context menu exit animation (100 ms) with a frame of slack. */
const EXIT_MS = 110;

/**
 * One retained context menu: the open menu's state, and a copy that keeps rendering for the exit
 * animation after it closes. Opening another menu of the same kind drops any closing copy.
 */
export function useClosingMenu<State>() {
  const [menu, setMenu] = useState<State | null>(null);
  const [closing, setClosing] = useState<State | null>(null);
  // Opening and closing in one handler must see each other, before React re-renders.
  const current = useRef<State | null>(null);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => clearTimeout(timer));
  }, []);

  const actions = useMemo(
    () => ({
      open(next: State) {
        current.current = next;
        setMenu(next);
        setClosing(null);
      },
      close() {
        const closed = current.current;
        if (closed === null) return;
        current.current = null;
        setMenu(null);
        setClosing(closed);
        const timer = setTimeout(() => {
          timers.current.delete(timer);
          setClosing((shown) => (shown === closed ? null : shown));
        }, EXIT_MS);
        timers.current.add(timer);
      },
    }),
    [],
  );
  return useMemo(() => ({ menu, closing, ...actions }), [actions, closing, menu]);
}
