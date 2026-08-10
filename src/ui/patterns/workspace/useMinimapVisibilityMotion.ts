import { useCallback, useLayoutEffect, useRef, type RefObject } from "react";
import { useMaterialSurfaceMaskOpacity } from "../../materials/MaterialSurfaceRegistration";
import { useMotionFrameScheduler } from "../../motion/MotionProvider";
import { interpolate, normalizedProgress } from "../../motion/motionMath";
import { useReducedMotion } from "../../motion/reducedMotionPreference";

/** Retained production Minimap fade duration; App owns the matching unmount timer. */
export const MINIMAP_VISIBILITY_DURATION_MS = 500;

export function useMinimapVisibilityMotion(
  surfaceRef: RefObject<HTMLElement | null>,
  visible: boolean,
): void {
  const scheduler = useMotionFrameScheduler();
  const reducedMotion = useReducedMotion();
  const setMaskOpacity = useMaterialSurfaceMaskOpacity(surfaceRef);
  const opacityRef = useRef(visible ? 0 : 1);
  const initializedRef = useRef(false);

  const writeOpacity = useCallback(
    (opacity: number, active: boolean) => {
      const settledOpacity = Math.min(1, Math.max(0, opacity));
      opacityRef.current = settledOpacity;
      const surface = surfaceRef.current;
      if (surface) {
        surface.style.opacity = `${settledOpacity}`;
        surface.style.willChange = active ? "opacity" : "";
      }
      setMaskOpacity(settledOpacity);
    },
    [setMaskOpacity, surfaceRef],
  );

  useLayoutEffect(() => {
    const target = visible ? 1 : 0;
    if (reducedMotion) {
      initializedRef.current = true;
      writeOpacity(target, false);
      return;
    }

    const from = initializedRef.current ? opacityRef.current : visible ? 0 : 1;
    initializedRef.current = true;
    if (from === target) {
      writeOpacity(target, false);
      return;
    }

    writeOpacity(from, true);
    let elapsedMs = 0;
    return scheduler.subscribe(({ deltaMs }) => {
      elapsedMs += deltaMs;
      const progress = normalizedProgress(elapsedMs, 0, MINIMAP_VISIBILITY_DURATION_MS);
      const easedProgress = progress * progress * (3 - 2 * progress);
      writeOpacity(interpolate(from, target, easedProgress), progress < 1);
      return progress < 1;
    });
  }, [reducedMotion, scheduler, visible, writeOpacity]);
}
