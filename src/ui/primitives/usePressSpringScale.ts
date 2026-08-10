import { useCallback, useEffect, useRef, type RefObject } from "react";
import { useMaterialSurfaceGeometryInvalidation } from "../materials/MaterialSurfaceRegistration";
import { useMotionFrameScheduler } from "../motion/MotionProvider";
import {
  advanceScalarSpring,
  isScalarSpringSettled,
  settleScalarSpring,
  type ScalarSpringState,
} from "../motion/motionMath";
import { SPRING } from "../motion/motionTokens";
import { useReducedMotion } from "../motion/reducedMotionPreference";

export const ACRYLIC_BUTTON_PRESSED_SCALE = 0.965;

export function usePressSpringScale(surfaceRef: RefObject<HTMLElement | null>) {
  const scaleRef = useRef<ScalarSpringState>(settleScalarSpring(1));
  const targetRef = useRef(1);
  const cancelRef = useRef<(() => void) | null>(null);
  const scheduler = useMotionFrameScheduler();
  const reducedMotion = useReducedMotion();
  const invalidateGeometry = useMaterialSurfaceGeometryInvalidation();

  const writeScale = useCallback(
    (scale: number) => {
      if (surfaceRef.current) surfaceRef.current.style.transform = `scale(${scale})`;
      invalidateGeometry();
    },
    [invalidateGeometry, surfaceRef],
  );

  const animateScale = useCallback(
    (target: number) => {
      targetRef.current = target;
      if (reducedMotion) {
        cancelRef.current?.();
        cancelRef.current = null;
        scaleRef.current = settleScalarSpring(target);
        writeScale(target);
        return;
      }
      if (cancelRef.current) return;
      cancelRef.current = scheduler.subscribe(({ deltaMs }) => {
        const next = advanceScalarSpring(
          scaleRef.current,
          targetRef.current,
          SPRING.snappy,
          deltaMs,
        );
        scaleRef.current = next;
        writeScale(next.position);
        if (!isScalarSpringSettled(next, targetRef.current, SPRING.snappy)) return true;
        scaleRef.current = settleScalarSpring(targetRef.current);
        writeScale(targetRef.current);
        cancelRef.current = null;
        return false;
      });
    },
    [reducedMotion, scheduler, writeScale],
  );

  useEffect(
    () => () => {
      cancelRef.current?.();
      cancelRef.current = null;
    },
    [],
  );

  return Object.freeze({
    press: () => animateScale(ACRYLIC_BUTTON_PRESSED_SCALE),
    release: () => animateScale(1),
  });
}
