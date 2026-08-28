import {
  forwardRef,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { FloatingPanel } from "./FloatingPanel";
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
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "onChange" | "value"
> {
  readonly options: readonly SelectOption[];
  readonly placeholder?: string;
  readonly value: string;
  readonly onValueChange: (value: string) => void;
}

export const Select = forwardRef<HTMLButtonElement, SelectProps>(function Select(
  {
    "aria-describedby": describedBy,
    "aria-invalid": invalid,
    className,
    id,
    onValueChange,
    options,
    placeholder = "Select…",
    value,
    ...props
  },
  ref,
) {
  const field = useFieldControl(id, describedBy, invalid);
  const listboxId = useId();
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);
  return (
    <>
      <button
        {...props}
        ref={(element) => {
          anchorRef.current = element;
          if (typeof ref === "function") ref(element);
          else if (ref) ref.current = element;
        }}
        id={field.id}
        type="button"
        role="combobox"
        tabIndex={-1}
        aria-controls={listboxId}
        aria-describedby={field.describedBy}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-invalid={field.invalid}
        onClick={() => setOpen((current) => !current)}
        className={primitiveClassNames("taskmap-input taskmap-select", className)}
      >
        <span className="taskmap-select__value">{selected?.label ?? placeholder}</span>
        <span className="taskmap-select__chevron" aria-hidden="true" />
      </button>
      <FloatingPanel
        anchorRef={anchorRef}
        dismissOnOutsidePress
        matchAnchorWidth
        open={open}
        onOpenChange={setOpen}
        className="taskmap-select__panel"
      >
        <div id={listboxId} role="listbox" aria-label={props["aria-label"]}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              tabIndex={-1}
              aria-selected={option.value === value}
              disabled={option.disabled}
              className="taskmap-select__option"
              onClick={() => {
                onValueChange(option.value);
                setOpen(false);
              }}
            >
              <span className="taskmap-select__option-check" aria-hidden="true">
                <svg viewBox="0 0 16 16">
                  <path d="M3 8.5 6.5 12 13 4.5" />
                </svg>
              </span>
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      </FloatingPanel>
    </>
  );
});
