import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from "react";
import { primitiveClassNames } from "./primitiveClassNames";

export interface ContextMenuItemProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** When set, the item is a checkable `menuitemcheckbox` with a trailing check mark. */
  readonly checked?: boolean;
  readonly danger?: boolean;
  readonly description?: string;
  readonly icon?: ReactNode;
}

/** Every focusable item role the menu's roving focus and keyboard handling manage. */
export const CONTEXT_MENU_ITEM_SELECTOR = '[role="menuitem"], [role="menuitemcheckbox"]';

export const ContextMenuItem = forwardRef<HTMLButtonElement, ContextMenuItemProps>(
  function ContextMenuItem(
    {
      checked,
      children,
      className,
      danger = false,
      description,
      icon,
      tabIndex = -1,
      type = "button",
      ...props
    },
    ref,
  ) {
    const checkable = checked !== undefined;
    return (
      <button
        {...props}
        ref={ref}
        type={type}
        role={checkable ? "menuitemcheckbox" : "menuitem"}
        aria-checked={checkable ? checked : undefined}
        tabIndex={tabIndex}
        data-tone={danger ? "danger" : "default"}
        className={primitiveClassNames("taskmap-context-menu__item", className)}
      >
        {icon ? <span className="taskmap-context-menu__icon">{icon}</span> : null}
        <span className="taskmap-context-menu__item-copy">
          <span>{children}</span>
          {description ? <small>{description}</small> : null}
        </span>
        {checkable ? (
          <span className="taskmap-context-menu__check" aria-hidden="true">
            <svg viewBox="0 0 12 12" width="12" height="12">
              <path d="M2.5 6.2 5 8.6l4.5-5" fill="none" stroke="currentColor" strokeWidth="1.8" />
            </svg>
          </span>
        ) : null}
      </button>
    );
  },
);

export function ContextMenuDivider() {
  return <div role="separator" className="taskmap-context-menu__divider" />;
}

export interface ContextMenuSectionProps extends HTMLAttributes<HTMLDivElement> {
  readonly label: string;
}

export function ContextMenuSection({
  children,
  className,
  label,
  ...props
}: ContextMenuSectionProps) {
  return (
    <div {...props} className={primitiveClassNames("taskmap-context-menu__section", className)}>
      <div className="taskmap-context-menu__section-label">{label}</div>
      {children}
    </div>
  );
}

export interface ContextMenuActionGroupProps extends HTMLAttributes<HTMLDivElement> {
  readonly label: string;
}

export function ContextMenuActionGroup({
  className,
  label,
  ...props
}: ContextMenuActionGroupProps) {
  return (
    <div
      {...props}
      role="group"
      aria-label={label}
      className={primitiveClassNames("taskmap-context-menu__action-group", className)}
    />
  );
}

export interface ContextMenuIconActionProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly icon: ReactNode;
  readonly "aria-label": string;
}

export function ContextMenuIconAction({
  icon,
  tabIndex = -1,
  type = "button",
  ...props
}: ContextMenuIconActionProps) {
  return (
    <button
      {...props}
      type={type}
      role="menuitem"
      tabIndex={tabIndex}
      className="taskmap-context-menu__icon-action"
    >
      {icon}
    </button>
  );
}

export function ContextMenuSwatches({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} className={primitiveClassNames("taskmap-context-menu__swatches", className)} />
  );
}

export interface ContextMenuSwatchProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly color: string;
  readonly selected?: boolean;
  readonly "aria-label": string;
}

/** Colour choice inside a menu; the selected swatch shows an inner mark. */
export function ContextMenuSwatch({
  color,
  selected = false,
  style,
  tabIndex = -1,
  type = "button",
  ...props
}: ContextMenuSwatchProps) {
  return (
    <button
      {...props}
      type={type}
      role="menuitem"
      tabIndex={tabIndex}
      aria-pressed={selected}
      className="taskmap-context-menu__swatch"
      style={{ ...style, backgroundColor: color }}
    />
  );
}
