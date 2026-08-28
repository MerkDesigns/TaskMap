import { useLayoutEffect, useRef, useState, type HTMLAttributes } from "react";
import { useMaterialSurfaceGeometryInvalidation } from "../materials/MaterialSurfaceRegistration";
import { MaterialSurface } from "../materials/MaterialSurface";
import {
  advanceLiquidIndicator,
  createLiquidIndicatorState,
  LIQUID_MAX_RADIUS_PX,
  LIQUID_REST_RADIUS_PX,
  type LiquidIndicatorState,
  type LiquidIndicatorTarget,
} from "../motion/liquidIndicatorMotion";
import { useMotionFrameScheduler } from "../motion/MotionProvider";
import { useReducedMotion } from "../motion/reducedMotionPreference";
import { primitiveClassNames } from "./primitiveClassNames";
import "./navigation.css";

export interface LiquidSelectionIndicatorProps extends HTMLAttributes<HTMLElement> {
  readonly movingRadius?: number;
  readonly settledRadius?: number;
  readonly target: LiquidIndicatorTarget;
}

export function LiquidSelectionIndicator({
  className,
  movingRadius = LIQUID_MAX_RADIUS_PX,
  settledRadius = LIQUID_REST_RADIUS_PX,
  target,
  ...props
}: LiquidSelectionIndicatorProps) {
  const surfaceRef = useRef<HTMLElement>(null);
  const stateRef = useRef<LiquidIndicatorState | null>(null);
  const orientationRef = useRef<"horizontal" | "vertical">("horizontal");
  const cancelRef = useRef<(() => void) | null>(null);
  const [radius, setRadius] = useState(LIQUID_REST_RADIUS_PX);
  const scheduler = useMotionFrameScheduler();
  const reducedMotion = useReducedMotion();
  const invalidateGeometry = useMaterialSurfaceGeometryInvalidation();
  const orientation = "top" in target ? "vertical" : "horizontal";
  const targetOffset = "top" in target ? target.top : target.left;
  const targetSize = "height" in target ? target.height : target.width;

  useLayoutEffect(() => {
    const currentTarget: LiquidIndicatorTarget =
      orientation === "vertical"
        ? { orientation, top: targetOffset, height: targetSize }
        : { orientation, left: targetOffset, width: targetSize };
    cancelRef.current?.();
    cancelRef.current = null;
    if (orientationRef.current !== orientation) stateRef.current = null;
    orientationRef.current = orientation;
    stateRef.current ??= createLiquidIndicatorState(currentTarget);

    const write = (offset: number, size: number, nextRadius: number) => {
      const element = surfaceRef.current;
      if (!element) return;
      if (orientation === "vertical") {
        element.style.removeProperty("width");
        element.style.height = `${size}px`;
        element.style.transform = `translate3d(0, ${offset}px, 0)`;
      } else {
        element.style.removeProperty("height");
        element.style.width = `${size}px`;
        element.style.transform = `translate3d(${offset}px, 0, 0)`;
      }
      const movingProgress = Math.max(
        0,
        Math.min(
          1,
          (nextRadius - LIQUID_REST_RADIUS_PX) / (LIQUID_MAX_RADIUS_PX - LIQUID_REST_RADIUS_PX),
        ),
      );
      setRadius(Math.max(0, settledRadius + movingProgress * (movingRadius - settledRadius)));
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
  }, [
    invalidateGeometry,
    movingRadius,
    orientation,
    reducedMotion,
    scheduler,
    settledRadius,
    targetOffset,
    targetSize,
  ]);

  return (
    <MaterialSurface
      {...props}
      ref={surfaceRef}
      material="acrylic-small"
      effect="bright-selection"
      elevation="none"
      radius={radius}
      aria-hidden="true"
      data-orientation={orientation}
      className={primitiveClassNames("taskmap-liquid-indicator", className)}
    />
  );
}
