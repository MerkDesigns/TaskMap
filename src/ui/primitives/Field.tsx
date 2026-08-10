import {
  createContext,
  isValidElement,
  useContext,
  useId,
  type AriaAttributes,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { primitiveClassNames } from "./primitiveClassNames";
import "./forms.css";

interface FieldContextValue {
  readonly controlId: string;
  readonly describedBy?: string;
  readonly invalid: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

export interface FieldProps extends HTMLAttributes<HTMLDivElement> {
  readonly label: ReactNode;
  readonly description?: ReactNode;
  readonly error?: ReactNode;
  readonly required?: boolean;
  readonly children: ReactNode;
}

export function Field({
  children,
  className,
  description,
  error,
  label,
  required,
  ...props
}: FieldProps) {
  const generatedId = useId();
  const explicitControlId =
    isValidElement<{ id?: string }>(children) && typeof children.props.id === "string"
      ? children.props.id
      : undefined;
  const controlId = explicitControlId ?? generatedId;
  const descriptionId = description ? `${generatedId}-description` : undefined;
  const errorId = error ? `${generatedId}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div {...props} className={primitiveClassNames("taskmap-field", className)}>
      <label className="taskmap-field__label" htmlFor={controlId}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      <FieldContext.Provider value={{ controlId, describedBy, invalid: Boolean(error) }}>
        {children}
      </FieldContext.Provider>
      {description ? (
        <div id={descriptionId} className="taskmap-field__description">
          {description}
        </div>
      ) : null}
      {error ? (
        <div id={errorId} className="taskmap-field__error">
          {error}
        </div>
      ) : null}
    </div>
  );
}

export function useFieldControl(
  id: string | undefined,
  describedBy: string | undefined,
  invalid: AriaAttributes["aria-invalid"],
) {
  const field = useContext(FieldContext);
  return {
    id: id ?? field?.controlId,
    describedBy: mergeIdReferences(describedBy, field?.describedBy),
    invalid: invalid ?? field?.invalid ?? undefined,
  };
}

function mergeIdReferences(...values: readonly (string | undefined)[]): string | undefined {
  const ids = values.flatMap((value) => value?.split(/\s+/).filter(Boolean) ?? []);
  return ids.length > 0 ? [...new Set(ids)].join(" ") : undefined;
}
