import { useEffect, useRef, useState, type ButtonHTMLAttributes } from "react";
import { MaterialSurface } from "../materials/MaterialSurface";
import { useMaterialSurfaceGeometryInvalidation } from "../materials/MaterialSurfaceRegistration";
import { useMotionFrameScheduler } from "../motion/MotionProvider";
import {
  advanceLiquidToggle,
  createLiquidToggleState,
  type LiquidToggleFrame,
} from "../motion/liquidToggleMotion";
import { useReducedMotion } from "../motion/reducedMotionPreference";
import { primitiveClassNames } from "./primitiveClassNames";
import "./liquidToggleSwitch.css";

export interface LiquidToggleSwitchProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "onChange"
> {
  readonly checked: boolean;
  readonly label: string;
  readonly onCheckedChange: (checked: boolean) => void;
}

export function LiquidToggleSwitch({
  checked,
  className,
  disabled,
  label,
  onCheckedChange,
  ...props
}: LiquidToggleSwitchProps) {
  const stateRef = useRef(createLiquidToggleState(checked));
  const checkedRef = useRef(checked);
  const cancelRef = useRef<(() => void) | null>(null);
  const scheduler = useMotionFrameScheduler();
  const reducedMotion = useReducedMotion();
  const invalidateGeometry = useMaterialSurfaceGeometryInvalidation();
  const [frame, setFrame] = useState<LiquidToggleFrame>(() => settledFrame(checked));

  useEffect(() => {
    checkedRef.current = checked;
    if (reducedMotion) {
      cancelRef.current?.();
      cancelRef.current = null;
      const settled = settledFrame(checked);
      stateRef.current = settled.state;
      setFrame(settled);
      invalidateGeometry();
      return;
    }
    if (cancelRef.current) return;
    cancelRef.current = scheduler.subscribe(({ deltaMs }) => {
      const next = advanceLiquidToggle(stateRef.current, checkedRef.current, deltaMs);
      stateRef.current = next.state;
      setFrame(next);
      invalidateGeometry();
      if (!next.settled) return true;
      cancelRef.current = null;
      return false;
    });
  }, [checked, invalidateGeometry, reducedMotion, scheduler]);

  useEffect(
    () => () => {
      cancelRef.current?.();
      cancelRef.current = null;
    },
    [],
  );

  return (
    <button
      {...props}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={primitiveClassNames("taskmap-liquid-toggle", className)}
      onClick={() => onCheckedChange(!checked)}
    >
      <span className="taskmap-liquid-toggle__track" data-checked={checked} aria-hidden="true">
        <MaterialSurface
          material="acrylic-small"
          elevation="none"
          radius={frame.radius}
          className="taskmap-liquid-toggle__knob"
          data-switch-state={checked ? "on" : "off"}
          data-settled={frame.settled}
          style={{
            width: frame.width,
            height: frame.height,
            transform: `translate3d(${frame.x}px, -50%, 0)`,
          }}
        />
      </span>
    </button>
  );
}

function settledFrame(checked: boolean): LiquidToggleFrame {
  return advanceLiquidToggle(createLiquidToggleState(checked), checked, 0, true);
}
