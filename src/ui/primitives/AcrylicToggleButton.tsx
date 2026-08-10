import {
  forwardRef,
  useRef,
  type ButtonHTMLAttributes,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { MaterialSurface } from "../materials/MaterialSurface";
import { primitiveClassNames } from "./primitiveClassNames";
import { usePressSpringScale } from "./usePressSpringScale";
import "./acrylicToggleButton.css";

export interface AcrylicToggleButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly pressed: boolean;
  readonly icon?: ReactNode;
}

export const AcrylicToggleButton = forwardRef<HTMLButtonElement, AcrylicToggleButtonProps>(
  function AcrylicToggleButton(
    {
      children,
      className,
      disabled,
      icon,
      onBlur,
      onKeyDown,
      onKeyUp,
      onPointerCancel,
      onPointerDown,
      onPointerUp,
      pressed,
      type = "button",
      ...props
    },
    forwardedRef,
  ) {
    const surfaceRef = useRef<HTMLElement>(null);
    const pressScale = usePressSpringScale(surfaceRef);

    const press = (event: PointerEvent<HTMLButtonElement>) => {
      onPointerDown?.(event);
      if (event.defaultPrevented || disabled || event.button !== 0) return;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      pressScale.press();
    };
    const release = (event: PointerEvent<HTMLButtonElement>) => {
      onPointerUp?.(event);
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      pressScale.release();
    };
    const cancel = (event: PointerEvent<HTMLButtonElement>) => {
      onPointerCancel?.(event);
      pressScale.release();
    };
    const keyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
      onKeyDown?.(event);
      if (!event.defaultPrevented && !disabled && (event.key === " " || event.key === "Enter")) {
        pressScale.press();
      }
    };
    const keyUp = (event: KeyboardEvent<HTMLButtonElement>) => {
      onKeyUp?.(event);
      if (event.key === " " || event.key === "Enter") pressScale.release();
    };

    return (
      <MaterialSurface
        ref={surfaceRef}
        material="acrylic-small"
        elevation="none"
        radius={8}
        data-pressed={pressed}
        className={primitiveClassNames("taskmap-acrylic-toggle", className)}
      >
        <span className="taskmap-acrylic-toggle__state-layer" aria-hidden="true" />
        <button
          {...props}
          ref={forwardedRef}
          type={type}
          disabled={disabled}
          aria-pressed={pressed}
          className="taskmap-control taskmap-acrylic-toggle__button"
          onPointerDown={press}
          onPointerUp={release}
          onPointerCancel={cancel}
          onKeyDown={keyDown}
          onKeyUp={keyUp}
          onBlur={(event) => {
            onBlur?.(event);
            pressScale.release();
          }}
        >
          {icon ? <span className="taskmap-acrylic-toggle__icon">{icon}</span> : null}
          <span>{children}</span>
        </button>
      </MaterialSurface>
    );
  },
);
