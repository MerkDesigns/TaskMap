import { useEffect, useMemo, useRef, useState } from "react";
import { MINIMAP_VISIBILITY_DURATION_MS } from "../ui/patterns/workspace";

/** How long the minimap stays up after the camera last moved. */
const MINIMAP_LINGER_MS = 2200;

/**
 * When the minimap shows: camera changes bring it up, it lingers briefly and then fades out
 * before unmounting. Pointing at it or panning holds it up; the fade timer restarts on release.
 * Turning the minimap off hides it at once.
 */
export function useMinimapPresence(enabled: boolean, panning: boolean) {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const fadeTimer = useRef<number | null>(null);
  const unmountTimer = useRef<number | null>(null);

  const actions = useMemo(() => {
    const clearTimers = () => {
      if (fadeTimer.current !== null) window.clearTimeout(fadeTimer.current);
      if (unmountTimer.current !== null) window.clearTimeout(unmountTimer.current);
      fadeTimer.current = null;
      unmountTimer.current = null;
    };
    const show = () => {
      if (!enabledRef.current) return;
      setMounted(true);
      setVisible(true);
      clearTimers();
      fadeTimer.current = window.setTimeout(() => {
        fadeTimer.current = null;
        setVisible(false);
        unmountTimer.current = window.setTimeout(() => {
          unmountTimer.current = null;
          setMounted(false);
        }, MINIMAP_VISIBILITY_DURATION_MS);
      }, MINIMAP_LINGER_MS);
    };
    const hold = (held: boolean) => {
      show();
      if (held && fadeTimer.current !== null) {
        window.clearTimeout(fadeTimer.current);
        fadeTimer.current = null;
      }
    };
    return { show, hold, clearTimers };
  }, []);

  useEffect(() => actions.clearTimers, [actions]);

  useEffect(() => {
    if (enabled) return;
    actions.clearTimers();
    setVisible(false);
    setMounted(false);
  }, [actions, enabled]);

  const wasPanning = useRef(false);
  useEffect(() => {
    if (panning === wasPanning.current) return;
    wasPanning.current = panning;
    actions.hold(panning);
  }, [actions, panning]);

  return { visible, mounted, show: actions.show, hold: actions.hold };
}
