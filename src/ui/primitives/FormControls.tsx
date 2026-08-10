import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { useFieldControl } from "./Field";
import { primitiveClassNames } from "./primitiveClassNames";
import "./forms.css";

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "prefix"> {
  readonly prefixSlot?: ReactNode;
  readonly suffixSlot?: ReactNode;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  {
    "aria-describedby": describedBy,
    "aria-invalid": invalid,
    className,
    id,
    prefixSlot,
    suffixSlot,
    ...props
  },
  ref,
) {
  const field = useFieldControl(id, describedBy, invalid);
  return (
    <span className="taskmap-input-shell">
      {prefixSlot ? <span className="taskmap-input-shell__slot">{prefixSlot}</span> : null}
      <input
        {...props}
        ref={ref}
        id={field.id}
        aria-describedby={field.describedBy}
        aria-invalid={field.invalid}
        className={primitiveClassNames("taskmap-input", className)}
      />
      {suffixSlot ? <span className="taskmap-input-shell__slot">{suffixSlot}</span> : null}
    </span>
  );
});

export const SearchField = forwardRef<HTMLInputElement, TextFieldProps>(
  function SearchField(props, ref) {
    return <TextField {...props} ref={ref} type="search" />;
  },
);

export type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { "aria-describedby": describedBy, "aria-invalid": invalid, className, id, ...props },
  ref,
) {
  const field = useFieldControl(id, describedBy, invalid);
  return (
    <textarea
      {...props}
      ref={ref}
      id={field.id}
      aria-describedby={field.describedBy}
      aria-invalid={field.invalid}
      className={primitiveClassNames("taskmap-input taskmap-textarea", className)}
    />
  );
});

export interface SelectOption {
  readonly value: string;
  readonly label: ReactNode;
  readonly disabled?: boolean;
}

export interface SelectProps extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "value" | "onChange"
> {
  readonly options: readonly SelectOption[];
  readonly value: string;
  readonly onValueChange: (value: string) => void;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    "aria-describedby": describedBy,
    "aria-invalid": invalid,
    className,
    id,
    onValueChange,
    options,
    value,
    ...props
  },
  ref,
) {
  const field = useFieldControl(id, describedBy, invalid);
  return (
    <select
      {...props}
      ref={ref}
      id={field.id}
      value={value}
      aria-describedby={field.describedBy}
      aria-invalid={field.invalid}
      onChange={(event) => onValueChange(event.currentTarget.value)}
      className={primitiveClassNames("taskmap-input taskmap-select", className)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value} disabled={option.disabled}>
          {option.label}
        </option>
      ))}
    </select>
  );
});
