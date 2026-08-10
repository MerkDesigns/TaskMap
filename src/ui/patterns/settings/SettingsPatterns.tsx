import {
  forwardRef,
  type ForwardedRef,
  type HTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from "react";
import { MaterialSurface } from "../../materials/MaterialSurface";
import { LiquidToggleSwitch } from "../../primitives/LiquidToggleSwitch";
import "./SettingsPatterns.css";

export const SettingsShell = forwardRef<HTMLDivElement, HTMLAttributes<HTMLElement>>(
  function SettingsShell({ className, ...props }, ref) {
    return (
      <MaterialSurface
        {...props}
        ref={ref as ForwardedRef<HTMLElement>}
        material="acrylic-large"
        radius={12}
        className={["taskmap-settings-shell", className].filter(Boolean).join(" ")}
      />
    );
  },
);

export const SettingsIsland = forwardRef<HTMLElement, HTMLAttributes<HTMLElement>>(
  function SettingsIsland({ className, ...props }, ref) {
    return (
      <MaterialSurface
        {...props}
        ref={ref}
        material="acrylic-small"
        radius={8}
        as="section"
        className={["taskmap-settings-island", className].filter(Boolean).join(" ")}
      />
    );
  },
);

export interface SettingsRowProps extends HTMLAttributes<HTMLDivElement> {
  readonly description?: ReactNode;
  readonly leading?: ReactNode;
  readonly label: ReactNode;
  readonly control?: ReactNode;
}

export const SettingsRow = forwardRef<HTMLDivElement, SettingsRowProps>(function SettingsRow(
  { className, control, description, label, leading, ...props },
  ref,
) {
  return (
    <div
      {...props}
      ref={ref}
      className={["taskmap-settings-row", className].filter(Boolean).join(" ")}
    >
      {leading ? <span className="taskmap-settings-row__leading">{leading}</span> : null}
      <span className="taskmap-settings-row__copy">
        <span className="taskmap-settings-row__label">{label}</span>
        {description ? (
          <span className="taskmap-settings-row__description">{description}</span>
        ) : null}
      </span>
      {control ? <span className="taskmap-settings-row__control">{control}</span> : null}
    </div>
  );
});

export interface SettingsToggleRowProps extends Omit<HTMLAttributes<HTMLElement>, "onChange"> {
  readonly checked: boolean;
  readonly description: ReactNode;
  readonly disabled?: boolean;
  readonly label: string;
  readonly leading?: ReactNode;
  readonly onCheckedChange: (checked: boolean) => void;
}

export function SettingsToggleRow({
  checked,
  className,
  description,
  disabled = false,
  label,
  leading,
  onCheckedChange,
  onClick,
  ...props
}: SettingsToggleRowProps) {
  const handleRowClick = (event: MouseEvent<HTMLElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || disabled) return;
    const target = event.target;
    if (target instanceof Element && target.closest("button, input, select, textarea, a")) return;
    onCheckedChange(!checked);
  };

  return (
    <SettingsIsland
      {...props}
      data-disabled={disabled || undefined}
      className={["taskmap-settings-toggle-row", className].filter(Boolean).join(" ")}
      onClick={handleRowClick}
    >
      <SettingsRow
        leading={leading}
        label={label}
        description={description}
        control={
          <LiquidToggleSwitch
            checked={checked}
            disabled={disabled}
            label={label}
            onCheckedChange={onCheckedChange}
          />
        }
      />
    </SettingsIsland>
  );
}
