import { Select as MantineSelect, type SelectProps as MantineSelectProps } from "@mantine/core";
import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
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
  readonly label: string;
  readonly disabled?: boolean;
}

export interface SelectProps extends Omit<
  MantineSelectProps<string>,
  "classNames" | "data" | "onChange" | "unstyled" | "value"
> {
  readonly options: readonly SelectOption[];
  readonly value: string;
  readonly onValueChange: (value: string) => void;
}

export const Select = forwardRef<HTMLInputElement, SelectProps>(function Select(
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
    <MantineSelect
      {...props}
      ref={ref}
      id={field.id}
      value={value}
      aria-describedby={field.describedBy}
      aria-invalid={field.invalid}
      allowDeselect={false}
      data={options.map(({ disabled, label, value: optionValue }) => ({
        disabled,
        label,
        value: optionValue,
      }))}
      onChange={(nextValue) => {
        if (nextValue !== null) onValueChange(nextValue);
      }}
      classNames={{
        root: "taskmap-select-root",
        input: primitiveClassNames("taskmap-input taskmap-select", className),
        dropdown: "taskmap-select__dropdown",
        option: "taskmap-select__option",
        section: "taskmap-select__section",
      }}
    />
  );
});
