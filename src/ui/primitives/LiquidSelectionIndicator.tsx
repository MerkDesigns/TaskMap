import { useLayoutEffect, useRef, useState, type HTMLAttributes } from "react";
import { useMaterialSurfaceGeometryInvalidation } from "../materials/MaterialSurfaceRegistration";
import { MaterialSurface } from "../materials/MaterialSurface";
import {
  advanceLiquidIndicator,
  createLiquidIndicatorState,
  LIQUID_REST_RADIUS_PX,
  type LiquidIndicatorState,
  type LiquidIndicatorTarget,
} from "../motion/liquidIndicatorMotion";
import { useMotionFrameScheduler } from "../motion/MotionProvider";
import { useReducedMotion } from "../motion/reducedMotionPreference";
import { primitiveClassNames } from "./primitiveClassNames";
import "./navigation.css";

export interface LiquidSelectionIndicatorProps extends HTMLAttributes<HTMLElement> {
  readonly target: LiquidIndicatorTarget;
}

export function LiquidSelectionIndicator({
  className,
  target,
  ...props
}: LiquidSelectionIndicatorProps) {
  const surfaceRef = useRef<HTMLElement>(null);
  const stateRef = useRef<LiquidIndicatorState | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);
  const [radius, setRadius] = useState(LIQUID_REST_RADIUS_PX);
  const scheduler = useMotionFrameScheduler();
  const reducedMotion = useReducedMotion();
  const invalidateGeometry = useMaterialSurfaceGeometryInvalidation();
  const targetLeft = target.left;
  const targetWidth = target.width;

  useLayoutEffect(() => {
    const currentTarget = { left: targetLeft, width: targetWidth };
    cancelRef.current?.();
    cancelRef.current = null;
    stateRef.current ??= createLiquidIndicatorState(currentTarget);

    const write = (left: number, width: number, nextRadius: number) => {
      const element = surfaceRef.current;
      if (!element) return;
      element.style.width = `${width}px`;
      element.style.transform = `translate3d(${left}px, 0, 0)`;
      setRadius(nextRadius);
      invalidateGeometry();
    };

    if (reducedMotion) {
      const frame = advanceLiquidIndicator(stateRef.current, currentTarget, 0, true);
      stateRef.current = frame.state;
      write(frame.left, frame.width, frame.radius);
      return;
    }

    const initial = stateRef.current;
    write(
      initial.left.position,
      initial.right.position - initial.left.position,
      LIQUID_REST_RADIUS_PX,
    );
    cancelRef.current = scheduler.subscribe(({ deltaMs }) => {
      const frame = advanceLiquidIndicator(stateRef.current ?? initial, currentTarget, deltaMs);
      stateRef.current = frame.state;
      write(frame.left, frame.width, frame.radius);
      if (frame.settled) cancelRef.current = null;
      return !frame.settled;
    });
    return () => {
      cancelRef.current?.();
      cancelRef.current = null;
    };
  }, [invalidateGeometry, reducedMotion, scheduler, targetLeft, targetWidth]);

  return (
    <MaterialSurface
      {...props}
      ref={surfaceRef}
      material="acrylic-small"
      effect="bright-selection"
      elevation="none"
      radius={radius}
      aria-hidden="true"
      className={primitiveClassNames("taskmap-liquid-indicator", className)}
    />
  );
}
