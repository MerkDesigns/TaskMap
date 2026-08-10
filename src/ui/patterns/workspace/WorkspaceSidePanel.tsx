import {
  forwardRef,
  useCallback,
  useRef,
  type ForwardedRef,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { MaterialSurface } from "../../materials/MaterialSurface";
import { useWorkspaceSidePanelMotion } from "./useWorkspaceSidePanelMotion";
import "./WorkspaceSidePanel.css";

export interface WorkspaceSidePanelProps extends HTMLAttributes<HTMLElement> {
  readonly closing: boolean;
  readonly label: string;
}

export const WorkspaceSidePanel = forwardRef<HTMLDivElement, WorkspaceSidePanelProps>(
  function WorkspaceSidePanel({ className, closing, label, ...props }, forwardedRef) {
    const panelRef = useRef<HTMLElement | null>(null);
    useWorkspaceSidePanelMotion(panelRef, closing);
    const composedRef = useCallback(
      (element: HTMLElement | null) => {
        panelRef.current = element;
        assignRef(forwardedRef, element as HTMLDivElement | null);
      },
      [forwardedRef],
    );

    return (
      <MaterialSurface
        {...props}
        ref={composedRef}
        material="acrylic-large"
        aria-label={label}
        data-closing={closing || undefined}
        className={["taskmap-workspace-side-panel", className].filter(Boolean).join(" ")}
      />
    );
  },
);

export interface WorkspacePanelHeaderProps extends HTMLAttributes<HTMLDivElement> {
  readonly actions?: ReactNode;
  readonly icon: ReactNode;
  readonly meta?: ReactNode;
  readonly title: string;
}

export const WorkspacePanelHeader = forwardRef<HTMLDivElement, WorkspacePanelHeaderProps>(
  function WorkspacePanelHeader({ actions, className, icon, meta, title, ...props }, ref) {
    return (
      <div
        {...props}
        ref={ref}
        className={["taskmap-workspace-panel-header", className].filter(Boolean).join(" ")}
      >
        <div className="taskmap-workspace-panel-header__identity">
          <span className="taskmap-workspace-panel-header__icon" aria-hidden="true">
            {icon}
          </span>
          <h2 className="taskmap-workspace-panel-header__title">{title}</h2>
          {meta}
        </div>
        {actions ? <div className="taskmap-workspace-panel-header__actions">{actions}</div> : null}
      </div>
    );
  },
);

function assignRef(ref: ForwardedRef<HTMLDivElement>, element: HTMLDivElement | null): void {
  if (typeof ref === "function") ref(element);
  else if (ref) ref.current = element;
}
