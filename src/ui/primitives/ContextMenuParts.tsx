import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from "react";
import { primitiveClassNames } from "./primitiveClassNames";

export interface ContextMenuItemProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly danger?: boolean;
  readonly description?: string;
  readonly icon?: ReactNode;
}

export const ContextMenuItem = forwardRef<HTMLButtonElement, ContextMenuItemProps>(
  function ContextMenuItem(
    {
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
    return (
      <button
        {...props}
        ref={ref}
        type={type}
        role="menuitem"
        tabIndex={tabIndex}
        data-tone={danger ? "danger" : "default"}
        className={primitiveClassNames("taskmap-context-menu__item", className)}
      >
        {icon ? <span className="taskmap-context-menu__icon">{icon}</span> : null}
        <span className="taskmap-context-menu__item-copy">
          <span>{children}</span>
          {description ? <small>{description}</small> : null}
        </span>
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
