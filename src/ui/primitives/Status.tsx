import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { primitiveClassNames } from "./primitiveClassNames";
import "./status.css";

export type SemanticTone = "neutral" | "accent" | "danger" | "warning" | "success" | "info";

export interface ToneProps extends HTMLAttributes<HTMLSpanElement> {
  readonly tone?: SemanticTone;
}

export const Badge = forwardRef<HTMLSpanElement, ToneProps>(function Badge(
  { className, tone = "neutral", ...props },
  ref,
) {
  return (
    <span
      {...props}
      ref={ref}
      className={primitiveClassNames("taskmap-badge", `taskmap-tone--${tone}`, className)}
    />
  );
});

export interface StatusDotProps extends ToneProps {
  readonly label: string;
}

export const StatusDot = forwardRef<HTMLSpanElement, StatusDotProps>(function StatusDot(
  { className, label, tone = "neutral", ...props },
  ref,
) {
  return (
    <span
      {...props}
      ref={ref}
      role="status"
      className={primitiveClassNames("taskmap-status-dot", `taskmap-tone--${tone}`, className)}
    >
      <span className="taskmap-status-dot__mark" aria-hidden="true" />
      {label}
    </span>
  );
});

export const Keycap = forwardRef<HTMLElement, HTMLAttributes<HTMLElement>>(function Keycap(
  { className, ...props },
  ref,
) {
  return <kbd {...props} ref={ref} className={primitiveClassNames("taskmap-keycap", className)} />;
});

export const Counter = forwardRef<HTMLSpanElement, HTMLAttributes<HTMLSpanElement>>(
  function Counter({ className, ...props }, ref) {
    return (
      <span {...props} ref={ref} className={primitiveClassNames("taskmap-counter", className)} />
    );
  },
);

export interface SpinnerProps extends HTMLAttributes<HTMLSpanElement> {
  readonly label?: string;
}

export function Spinner({ className, label = "Loading", ...props }: SpinnerProps) {
  return (
    <span
      {...props}
      role="status"
      aria-label={label}
      className={primitiveClassNames("taskmap-spinner", className)}
    />
  );
}

export interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  readonly value?: number;
  readonly label: string;
  readonly detail?: ReactNode;
}

export function Progress({ className, detail, label, value, ...props }: ProgressProps) {
  const boundedValue = value === undefined ? undefined : Math.min(100, Math.max(0, value));
  return (
    <div {...props} className={primitiveClassNames("taskmap-progress", className)}>
      <span className="taskmap-progress__label">
        {label}
        {detail ? <span>{detail}</span> : null}
      </span>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={boundedValue}
        className={primitiveClassNames(
          "taskmap-progress__track",
          boundedValue === undefined && "taskmap-progress__track--indeterminate",
        )}
      >
        <span
          className="taskmap-progress__fill"
          style={boundedValue === undefined ? undefined : { width: `${boundedValue}%` }}
        />
      </div>
    </div>
  );
}
