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
import "./acrylicConfirmButton.css";

export interface AcrylicConfirmButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly icon?: ReactNode;
  readonly treatment?: "normal" | "glowing";
}

export const AcrylicConfirmButton = forwardRef<HTMLButtonElement, AcrylicConfirmButtonProps>(
  function AcrylicConfirmButton(
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
      treatment = "normal",
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
        data-treatment={treatment}
        data-disabled={disabled ? "true" : "false"}
        className={primitiveClassNames("taskmap-acrylic-confirm", className)}
      >
        <span className="taskmap-acrylic-confirm__wash" aria-hidden="true" />
        <button
          {...props}
          ref={forwardedRef}
          type={type}
          disabled={disabled}
          className="taskmap-control taskmap-acrylic-confirm__button"
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
          {icon ? <span className="taskmap-acrylic-confirm__icon">{icon}</span> : null}
          <span>{children}</span>
        </button>
      </MaterialSurface>
    );
  },
);
