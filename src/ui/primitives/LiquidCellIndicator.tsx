import { useLayoutEffect, useRef, useState, type HTMLAttributes } from "react";
import { MaterialSurface } from "../materials/MaterialSurface";
import {
  advanceLiquidCell,
  createLiquidCellState,
  liquidCellFrame,
  type LiquidCellFrame,
  type LiquidCellState,
} from "../motion/liquidCellMotion";
import { useMotionFrameScheduler } from "../motion/MotionProvider";
import { useReducedMotion } from "../motion/reducedMotionPreference";
import { usePresenceMotion } from "../motion/usePresenceMotion";
import { primitiveClassNames } from "./primitiveClassNames";
import "./navigation.css";

const FADE_IN = { durationMs: 160, easing: (progress: number) => progress };
const FADE_OUT = { durationMs: 280, easing: (progress: number) => progress };

export interface LiquidCellIndicatorProps extends HTMLAttributes<HTMLElement> {
  /** The centre of the cell to rest on, in the positioned parent's coordinates. */
  readonly x: number;
  readonly y: number;
  /** The cell's side; the indicator is square at rest. */
  readonly size: number;
  readonly settledRadius: number;
  /** Hidden, it fades out where it is; shown again, it fades in there and glides to its target. */
  readonly visible?: boolean;
  /** Glide without stretching, turning or rounding: the resting shape simply moves. */
  readonly rigid?: boolean;
  /** No blur: the cell beneath stays sharp under the glass. */
  readonly clear?: boolean;
}

/**
 * A liquid glass highlight that glides between cells of a grid in any direction: it stretches into
 * a capsule along its path, rounds while moving, and settles back to its resting shape.
 */
export function LiquidCellIndicator({
  className,
  x,
  y,
  size,
  settledRadius,
  visible = true,
  rigid = false,
  clear = false,
  ...props
}: LiquidCellIndicatorProps) {
  const surfaceRef = useRef<HTMLElement>(null);
  const stateRef = useRef<LiquidCellState | null>(null);
  const [radius, setRadius] = useState(settledRadius);
  const scheduler = useMotionFrameScheduler();
  const reducedMotion = useReducedMotion();
  const presence = usePresenceMotion(surfaceRef, {
    channels: { materialFade: true },
    enter: FADE_IN,
    exit: FADE_OUT,
    initialProgress: visible ? 1 : 0,
  });

  useLayoutEffect(() => {
    if (visible) presence.show();
    else presence.hide();
  }, [presence, visible]);

  useLayoutEffect(() => {
    const target = { x, y, size };
    const write = (frame: LiquidCellFrame) => {
      const element = surfaceRef.current;
      if (!element) return;
      element.style.width = `${frame.length}px`;
      element.style.height = `${frame.thickness}px`;
      element.style.transform = `translate3d(${frame.x - frame.length / 2}px, ${
        frame.y - frame.thickness / 2
      }px, 0) rotate(${frame.angle}deg)`;
      setRadius(frame.radius);
    };
    if (stateRef.current && !visible) return;
    if (!stateRef.current || reducedMotion) {
      const frame = advanceLiquidCell(
        stateRef.current ?? createLiquidCellState(target),
        target,
        0,
        settledRadius,
        true,
      );
      stateRef.current = frame.state;
      write(frame);
      return;
    }
    write(liquidCellFrame(stateRef.current, size, settledRadius));
    return scheduler.subscribe(({ deltaMs }) => {
      const frame = advanceLiquidCell(
        stateRef.current!,
        target,
        deltaMs,
        settledRadius,
        false,
        rigid,
      );
      stateRef.current = frame.state;
      write(frame);
      return !frame.settled;
    });
  }, [reducedMotion, rigid, scheduler, settledRadius, size, visible, x, y]);

  return (
    <MaterialSurface
      {...props}
      ref={surfaceRef}
      material="acrylic-small"
      effect={clear ? "clear-selection" : "bright-selection"}
      elevation="none"
      radius={radius}
      aria-hidden="true"
      className={primitiveClassNames("taskmap-liquid-cell-indicator", className)}
    />
  );
}
