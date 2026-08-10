import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { primitiveClassNames } from "./primitiveClassNames";
import "./animatedCheckbox.css";

export interface AnimatedCheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  readonly label?: ReactNode;
}

export const AnimatedCheckbox = forwardRef<HTMLInputElement, AnimatedCheckboxProps>(
  function AnimatedCheckbox({ className, label, ...props }, ref) {
    return (
      <label className={primitiveClassNames("taskmap-animated-checkbox", className)}>
        <input {...props} ref={ref} type="checkbox" className="taskmap-animated-checkbox__input" />
        <span className="taskmap-animated-checkbox__box" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <circle className="taskmap-animated-checkbox__dot" cx="6" cy="12.5" r="1.2" />
            <path
              className="taskmap-animated-checkbox__stroke taskmap-animated-checkbox__stroke--first"
              pathLength="1"
              d="M 6 12.5 L 10.2 16.5"
            />
            <path
              className="taskmap-animated-checkbox__stroke taskmap-animated-checkbox__stroke--second"
              pathLength="1"
              d="M 10.2 16.5 L 18.4 7.5"
            />
          </svg>
        </span>
        {label ? <span>{label}</span> : null}
      </label>
    );
  },
);
