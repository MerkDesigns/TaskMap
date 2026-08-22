import {
  forwardRef,
  useCallback,
  useLayoutEffect,
  useEffect,
  useRef,
  useState,
  type ForwardedRef,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { MaterialSurface } from "../../materials/MaterialSurface";
import { refreshMaterialSurfaceBackdrop } from "../../materials/materialGeometryInvalidation";
import { useReducedMotion } from "../../motion/reducedMotionPreference";
import {
  useWorkspaceSidePanelMotion,
  WORKSPACE_SIDE_PANEL_SLIDE_DURATION_MS,
} from "./useWorkspaceSidePanelMotion";
import "./WorkspaceSidePanel.css";
import { subscribeWorkspacePanelContentSizeChanged } from "./workspacePanelContentSize";

export { WORKSPACE_SIDE_PANEL_SLIDE_DURATION_MS };

export interface WorkspaceSidePanelProps extends HTMLAttributes<HTMLElement> {
  readonly backdropRevision?: string;
  readonly closing: boolean;
  readonly label: string;
  readonly radius?: number;
}

export const WorkspaceSidePanel = forwardRef<HTMLDivElement, WorkspaceSidePanelProps>(
  function WorkspaceSidePanel(
    { backdropRevision, children, className, closing, label, radius, ...props },
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
    useLayoutEffect(() => {
      const panel = motionRef.current;
      if (panel && backdropRevision !== undefined) refreshMaterialSurfaceBackdrop(panel);
    }, [backdropRevision]);

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
  const reducedMotion = useReducedMotion();
  const [height, setHeight] = useState<number | null>(null);
  const [outgoingIndex, setOutgoingIndex] = useState<0 | 1 | null>(null);
  const previousIndexRef = useRef(activeIndex);
  const heightInitializedRef = useRef(false);

  useLayoutEffect(() => {
    const activeView = viewRefs.current[activeIndex];
    if (!activeView) return;
    const previousIndex = previousIndexRef.current;
    previousIndexRef.current = activeIndex;
    if (previousIndex !== activeIndex) setOutgoingIndex(reducedMotion ? null : previousIndex);
    const nextHeight = measurePanelViewHeight(activeView);
    if (!heightInitializedRef.current) {
      heightInitializedRef.current = true;
      setHeight(nextHeight);
      return;
    }
    setHeight(nextHeight);
  }, [activeIndex, reducedMotion]);

  useLayoutEffect(() => {
    if (outgoingIndex !== null) return;
    const activeView = viewRefs.current[activeIndex];
    const observed = activeView?.firstElementChild;
    if (!activeView || !observed) return;
    const measure = () => setHeight(measurePanelViewHeight(activeView));
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(observed);
    const unsubscribeContentSize = subscribeWorkspacePanelContentSizeChanged(
      activeView,
      (contentHeight) => setHeight(clampPanelViewHeight(activeView, contentHeight)),
    );
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      unsubscribeContentSize();
      window.removeEventListener("resize", measure);
    };
  }, [activeIndex, outgoingIndex]);

  useEffect(() => {
    if (outgoingIndex === null) return;
    const timeout = window.setTimeout(() => setOutgoingIndex(null), 220);
    return () => window.clearTimeout(timeout);
  }, [outgoingIndex]);

  return (
    <div
      {...props}
      className={["taskmap-workspace-side-panel-switcher", className].filter(Boolean).join(" ")}
      data-height-ready={height === null ? undefined : true}
      style={{ ...style, height: height === null ? undefined : `${height}px` }}
    >
      {views.map((view, index) => {
        const active = index === activeIndex;
        const state = active ? "active" : outgoingIndex === index ? "outgoing" : "inactive";
        return (
          <div
            key={index}
            ref={(element) => {
              viewRefs.current[index] = element;
              element?.toggleAttribute("inert", !active);
            }}
            className="taskmap-workspace-side-panel-switcher__view"
            data-active={active || undefined}
            data-view-state={state}
            data-view-index={index}
            aria-hidden={!active}
            onTransitionEnd={(event) => {
              if (
                state === "outgoing" &&
                event.target === event.currentTarget &&
                event.propertyName === "opacity"
              ) {
                setOutgoingIndex(null);
              }
            }}
          >
            {view}
          </div>
        );
      })}
    </div>
  );
}

function measurePanelViewHeight(view: HTMLElement): number {
  const contentHeight = Math.max(view.scrollHeight, view.firstElementChild?.scrollHeight ?? 0);
  return clampPanelViewHeight(view, contentHeight);
}

function clampPanelViewHeight(view: HTMLElement, contentHeight: number): number {
  const panel = view.closest<HTMLElement>(".taskmap-workspace-side-panel");
  if (!panel) return Math.ceil(contentHeight);
  const bottomInset = Number.parseFloat(
    window.getComputedStyle(panel).getPropertyValue("--taskmap-chrome-inset-bottom"),
  );
  const availableHeight =
    window.innerHeight -
    panel.getBoundingClientRect().top -
    (Number.isFinite(bottomInset) ? bottomInset : 16);
  return Math.ceil(Math.min(contentHeight, Math.max(0, availableHeight)));
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
