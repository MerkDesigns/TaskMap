import {
  forwardRef,
  useId,
  useRef,
  type FieldsetHTMLAttributes,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { primitiveClassNames } from "./primitiveClassNames";
import "./controls.css";

interface LabeledCheckProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  readonly label?: ReactNode;
}

export const Checkbox = forwardRef<HTMLInputElement, LabeledCheckProps>(function Checkbox(
  { className, label, ...props },
  ref,
) {
  return (
    <label className={primitiveClassNames("taskmap-check-control", className)}>
      <input {...props} ref={ref} type="checkbox" className="taskmap-check-control__input" />
      <span className="taskmap-check-control__box" aria-hidden="true">
        <svg viewBox="0 0 16 16">
          <path className="taskmap-check-control__mark" pathLength="1" d="M3 8.5 6.5 12 13 4.5" />
        </svg>
      </span>
      {label ? <span className="taskmap-check-control__label">{label}</span> : null}
    </label>
  );
});

export const Switch = forwardRef<HTMLInputElement, LabeledCheckProps>(function Switch(
  { className, label, ...props },
  ref,
) {
  return (
    <label className={primitiveClassNames("taskmap-switch", className)}>
      <input {...props} ref={ref} type="checkbox" role="switch" className="taskmap-switch__input" />
      <span className="taskmap-switch__track" aria-hidden="true">
        <span className="taskmap-switch__thumb" />
      </span>
      {label ? <span className="taskmap-switch__label">{label}</span> : null}
    </label>
  );
});

export interface RadioItem<Value extends string = string> {
  readonly value: Value;
  readonly label: ReactNode;
  readonly disabled?: boolean;
}

export interface RadioGroupProps<Value extends string = string> extends Omit<
  FieldsetHTMLAttributes<HTMLFieldSetElement>,
  "onChange"
> {
  readonly label: ReactNode;
  readonly name: string;
  readonly items: readonly RadioItem<Value>[];
  readonly value: Value;
  readonly onValueChange: (value: Value) => void;
}

export function RadioGroup<Value extends string>({
  className,
  items,
  label,
  name,
  onValueChange,
  value,
  ...props
}: RadioGroupProps<Value>) {
  return (
    <fieldset {...props} className={primitiveClassNames("taskmap-radio-group", className)}>
      <legend className="taskmap-radio-group__legend">{label}</legend>
      {items.map((item) => (
        <label key={item.value} className="taskmap-radio">
          <input
            type="radio"
            name={name}
            value={item.value}
            checked={item.value === value}
            disabled={item.disabled}
            onChange={() => onValueChange(item.value)}
          />
          <span className="taskmap-radio__mark" aria-hidden="true" />
          <span>{item.label}</span>
        </label>
      ))}
    </fieldset>
  );
}

export type SliderProps = Omit<InputHTMLAttributes<HTMLInputElement>, "step" | "type">;

export const Slider = forwardRef<HTMLInputElement, SliderProps>(function Slider(
  { className, ...props },
  ref,
) {
  return (
    <input
      {...props}
      ref={ref}
      type="range"
      step="any"
      className={primitiveClassNames("taskmap-slider", className)}
    />
  );
});

export interface SegmentedItem<Value extends string = string> {
  readonly value: Value;
  readonly label: ReactNode;
  readonly disabled?: boolean;
}

export interface SegmentedControlProps<Value extends string = string> {
  readonly label: string;
  readonly items: readonly SegmentedItem<Value>[];
  readonly value: Value;
  readonly onValueChange: (value: Value) => void;
  readonly className?: string;
}

export function SegmentedControl<Value extends string>({
  className,
  items,
  label,
  onValueChange,
  value,
}: SegmentedControlProps<Value>) {
  const rootId = useId();
  const refs = useRef(new Map<Value, HTMLButtonElement>());
  const enabled = items.filter((item) => !item.disabled);
  const activeValue = enabled.some((item) => item.value === value) ? value : enabled[0]?.value;

  const move = (event: KeyboardEvent<HTMLButtonElement>, current: Value) => {
    const direction =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    let target: Value | undefined;
    if (event.key === "Home") target = enabled[0]?.value;
    else if (event.key === "End") target = enabled[enabled.length - 1]?.value;
    else if (direction) {
      const index = enabled.findIndex((item) => item.value === current);
      target = enabled[(index + direction + enabled.length) % enabled.length]?.value;
    }
    if (!target) return;
    event.preventDefault();
    onValueChange(target);
    refs.current.get(target)?.focus();
  };

  return (
    <div
      role="group"
      aria-label={label}
      className={primitiveClassNames("taskmap-segmented", className)}
    >
      {items.map((item, index) => (
        <button
          key={item.value}
          ref={(element) => {
            if (element) refs.current.set(item.value, element);
            else refs.current.delete(item.value);
          }}
          id={`${rootId}-segment-${index}`}
          type="button"
          disabled={item.disabled}
          aria-pressed={item.value === value}
          tabIndex={item.value === activeValue ? 0 : -1}
          onClick={() => onValueChange(item.value)}
          onKeyDown={(event) => move(event, item.value)}
          className="taskmap-control taskmap-segmented__item"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
