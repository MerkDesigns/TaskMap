import { useEffect, useState } from "react";
import { useReducedMotion } from "../../motion/reducedMotionPreference";

export const WORKSPACE_PANEL_VIEW_TRANSITION_MS = 180;

export function useSettledPanelWork(active: boolean): boolean {
  const reducedMotion = useReducedMotion();
  const [workActive, setWorkActive] = useState(active);

  useEffect(() => {
    if (active) {
      setWorkActive(true);
      return;
    }
    if (reducedMotion) {
      setWorkActive(false);
      return;
    }
    const handle = window.setTimeout(
      () => setWorkActive(false),
      WORKSPACE_PANEL_VIEW_TRANSITION_MS,
    );
    return () => window.clearTimeout(handle);
  }, [active, reducedMotion]);

  return active || workActive;
}
