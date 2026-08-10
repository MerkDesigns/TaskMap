import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from "react";
import { primitiveClassNames } from "./primitiveClassNames";
import "./controls.css";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "compact" | "normal";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly leadingIcon?: ReactNode;
  readonly trailingIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    children,
    className,
    leadingIcon,
    size = "normal",
    trailingIcon,
    type = "button",
    variant = "secondary",
    ...props
  },
  ref,
) {
  return (
    <button
      {...props}
      ref={ref}
      type={type}
      className={primitiveClassNames(
        "taskmap-control taskmap-button",
        `taskmap-button--${variant}`,
        `taskmap-button--${size}`,
        className,
      )}
    >
      {leadingIcon ? <span className="taskmap-button__icon">{leadingIcon}</span> : null}
      <span className="taskmap-button__label">{children}</span>
      {trailingIcon ? <span className="taskmap-button__icon">{trailingIcon}</span> : null}
    </button>
  );
});

export interface IconButtonProps extends Omit<
  ButtonProps,
  "children" | "leadingIcon" | "trailingIcon"
> {
  readonly icon: ReactNode;
  readonly "aria-label": string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { className, icon, ...props },
  ref,
) {
  return (
    <Button {...props} ref={ref} className={primitiveClassNames("taskmap-icon-button", className)}>
      <span aria-hidden="true">{icon}</span>
    </Button>
  );
});

export interface ToggleButtonProps extends ButtonProps {
  readonly pressed: boolean;
}

export const ToggleButton = forwardRef<HTMLButtonElement, ToggleButtonProps>(function ToggleButton(
  { className, pressed, ...props },
  ref,
) {
  return (
    <Button
      {...props}
      ref={ref}
      aria-pressed={pressed}
      className={primitiveClassNames("taskmap-toggle-button", className)}
    />
  );
});

export interface ButtonGroupProps extends HTMLAttributes<HTMLDivElement> {
  readonly label: string;
  readonly children: ReactNode;
}

export const ButtonGroup = forwardRef<HTMLDivElement, ButtonGroupProps>(function ButtonGroup(
  { children, className, label, ...props },
  ref,
) {
  return (
    <div
      {...props}
      ref={ref}
      role="group"
      aria-label={label}
      className={primitiveClassNames("taskmap-button-group", className)}
    >
      {children}
    </div>
  );
});
