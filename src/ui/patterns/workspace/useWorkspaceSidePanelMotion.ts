import { useCallback, useLayoutEffect, useRef, type RefObject } from "react";
import {
  useMaterialSurfaceGeometryInvalidation,
  useMaterialSurfaceMaskOpacity,
} from "../../materials/MaterialSurfaceRegistration";
import { useMotionFrameScheduler } from "../../motion/MotionProvider";
import { interpolate, normalizedProgress } from "../../motion/motionMath";
import { MOTION_DURATION_MS } from "../../motion/motionTokens";
import { useReducedMotion } from "../../motion/reducedMotionPreference";

interface WorkspaceSidePanelMotionState {
  readonly x: number;
  readonly y: number;
  readonly opacity: number;
}

export const WORKSPACE_SIDE_PANEL_ENTER_FROM = Object.freeze({ x: -10, y: 2, opacity: 0 });
export const WORKSPACE_SIDE_PANEL_REST = Object.freeze({ x: 0, y: 0, opacity: 1 });
export const WORKSPACE_SIDE_PANEL_EXIT_TO = Object.freeze({ x: -8, y: 1, opacity: 0 });

export function useWorkspaceSidePanelMotion(
  panelRef: RefObject<HTMLElement | null>,
  closing: boolean,
): void {
  const scheduler = useMotionFrameScheduler();
  const reducedMotion = useReducedMotion();
  const invalidateGeometry = useMaterialSurfaceGeometryInvalidation();
  const setMaskOpacity = useMaterialSurfaceMaskOpacity(panelRef);
  const stateRef = useRef<WorkspaceSidePanelMotionState>(
    closing ? WORKSPACE_SIDE_PANEL_REST : WORKSPACE_SIDE_PANEL_ENTER_FROM,
  );
  const initializedRef = useRef(false);

  const write = useCallback(
    (state: WorkspaceSidePanelMotionState, active: boolean) => {
      stateRef.current = state;
      const panel = panelRef.current;
      if (panel) {
        panel.style.opacity = `${state.opacity}`;
        panel.style.transform = `translate3d(${state.x}px, ${state.y}px, 0)`;
        panel.style.willChange = active ? "opacity, transform" : "";
      }
      setMaskOpacity(state.opacity);
      invalidateGeometry();
    },
    [invalidateGeometry, panelRef, setMaskOpacity],
  );

  useLayoutEffect(() => {
    const target = closing ? WORKSPACE_SIDE_PANEL_EXIT_TO : WORKSPACE_SIDE_PANEL_REST;
    if (reducedMotion) {
      initializedRef.current = true;
      write(target, false);
      return;
    }

    const from = initializedRef.current
      ? stateRef.current
      : closing
        ? WORKSPACE_SIDE_PANEL_REST
        : WORKSPACE_SIDE_PANEL_ENTER_FROM;
    initializedRef.current = true;
    write(from, true);
    let elapsedMs = 0;
    const durationMs = closing ? MOTION_DURATION_MS.fast : MOTION_DURATION_MS.normal;
    const unsubscribe = scheduler.subscribe(({ deltaMs }) => {
      elapsedMs += deltaMs;
      const progress = normalizedProgress(elapsedMs, 0, durationMs);
      const easedProgress = closing ? progress * progress : 1 - Math.pow(1 - progress, 3);
      const next = Object.freeze({
        x: interpolate(from.x, target.x, easedProgress),
        y: interpolate(from.y, target.y, easedProgress),
        opacity: interpolate(from.opacity, target.opacity, easedProgress),
      });
      if (progress < 1) {
        write(next, true);
        return true;
      }
      write(target, false);
      return false;
    });
    return unsubscribe;
  }, [closing, reducedMotion, scheduler, write]);
}
