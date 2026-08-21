import {
  forwardRef,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ForwardedRef,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { MaterialSurface } from "../../materials/MaterialSurface";
import {
  useWorkspaceSidePanelMotion,
  WORKSPACE_SIDE_PANEL_SLIDE_DURATION_MS,
} from "./useWorkspaceSidePanelMotion";
import "./WorkspaceSidePanel.css";

export { WORKSPACE_SIDE_PANEL_SLIDE_DURATION_MS };

export interface WorkspaceSidePanelProps extends HTMLAttributes<HTMLElement> {
  readonly closing: boolean;
  readonly label: string;
  readonly radius?: number;
}

export const WorkspaceSidePanel = forwardRef<HTMLDivElement, WorkspaceSidePanelProps>(
  function WorkspaceSidePanel(
    { children, className, closing, label, radius, ...props },
    forwardedRef,
  ) {
    const motionRef = useRef<HTMLElement | null>(null);
    useWorkspaceSidePanelMotion(motionRef, closing);
    const panelRef = useCallback(
      (element: HTMLElement | null) => {
        motionRef.current = element;
        assignRef(forwardedRef, element as HTMLDivElement | null);
      },
      [forwardedRef],
    );

    return (
      <MaterialSurface
        {...props}
        ref={panelRef}
        material="acrylic-large"
        radius={radius}
        aria-label={label}
        data-closing={closing || undefined}
        className={["taskmap-workspace-side-panel", className].filter(Boolean).join(" ")}
      >
        {children}
      </MaterialSurface>
    );
  },
);

export interface WorkspacePanelHeaderProps extends HTMLAttributes<HTMLDivElement> {
  readonly actions?: ReactNode;
  readonly icon: ReactNode;
  readonly meta?: ReactNode;
  readonly title: string;
}

export interface WorkspaceSidePanelContentSwitcherProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "children"
> {
  readonly activeIndex: 0 | 1;
  readonly views: readonly [ReactNode, ReactNode];
}

export function WorkspaceSidePanelContentSwitcher({
  activeIndex,
  className,
  style,
  views,
  ...props
}: WorkspaceSidePanelContentSwitcherProps) {
  const viewRefs = useRef<Array<HTMLDivElement | null>>([null, null]);
  const [height, setHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const activeView = viewRefs.current[activeIndex];
    if (!activeView) return;
    const measure = () => {
      const contentHeight = Math.max(
        activeView.scrollHeight,
        activeView.firstElementChild?.scrollHeight ?? 0,
      );
      const panel = activeView.closest<HTMLElement>(".taskmap-workspace-side-panel");
      const panelStyle = panel ? window.getComputedStyle(panel) : null;
      const bottomInset = Number.parseFloat(
        panelStyle?.getPropertyValue("--taskmap-chrome-inset-bottom") ?? "",
      );
      const availableHeight = panel
        ? window.innerHeight -
          panel.getBoundingClientRect().top -
          (Number.isFinite(bottomInset) ? bottomInset : 16)
        : contentHeight;
      const nextHeight = Math.ceil(Math.min(contentHeight, Math.max(0, availableHeight)));
      setHeight((current) => (current === nextHeight ? current : nextHeight));
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(activeView);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [activeIndex]);

  return (
    <div
      {...props}
      className={["taskmap-workspace-side-panel-switcher", className].filter(Boolean).join(" ")}
      data-height-ready={height === null ? undefined : true}
      style={{ ...style, height: height === null ? undefined : `${height}px` }}
    >
      {views.map((view, index) => {
        const active = index === activeIndex;
        return (
          <div
            key={index}
            ref={(element) => {
              viewRefs.current[index] = element;
              element?.toggleAttribute("inert", !active);
            }}
            className="taskmap-workspace-side-panel-switcher__view"
            data-active={active || undefined}
            data-view-index={index}
            aria-hidden={!active}
          >
            {view}
          </div>
        );
      })}
    </div>
  );
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
