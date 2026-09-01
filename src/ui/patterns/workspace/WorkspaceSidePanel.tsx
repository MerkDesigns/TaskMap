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
import {
  SharedSmallGlassPlane,
  writeSharedSmallGlassShapes,
} from "../../materials/SharedSmallGlassPlane";
import { refreshMaterialSurfaceBackdrop } from "../../materials/materialGeometryInvalidation";
import { FadeSlideLeft } from "../../motion/presenceController";
import { MOTION_DURATION_MS } from "../../motion/motionTokens";
import { useReducedMotion } from "../../motion/reducedMotionPreference";
import { useSurfacePresence } from "../../motion/useSurfacePresence";
import "./WorkspaceSidePanel.css";
import { subscribeWorkspacePanelContentSizeChanged } from "./workspacePanelContentSize";

export const WORKSPACE_SIDE_PANEL_PRESENCE_DURATION_MS = MOTION_DURATION_MS.normal;

export function WorkspaceChromeMaterialWarmup() {
  const [mounted, setMounted] = useState(true);
  const smallPlaneRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const plane = smallPlaneRef.current;
    if (!plane) return;
    writeSharedSmallGlassShapes(plane, [{ x: 16, y: 16, width: 240, height: 84, radius: 10 }]);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setMounted(false);
    }, 500);
    return () => window.clearTimeout(timeout);
  }, []);

  if (!mounted) return null;

  return (
    <MaterialSurface
      material="acrylic-large"
      radius={19}
      geometryActive={false}
      aria-hidden="true"
      className="taskmap-workspace-material-warmup"
    >
      <SharedSmallGlassPlane ref={smallPlaneRef} kind="small-canvas" />
    </MaterialSurface>
  );
}

export interface WorkspaceSidePanelProps extends HTMLAttributes<HTMLElement> {
  readonly backdropRevision?: string | number;
  readonly closing: boolean;
  readonly label: string;
  readonly onExitComplete?: () => void;
  readonly radius?: number;
}

export const WorkspaceSidePanel = forwardRef<HTMLDivElement, WorkspaceSidePanelProps>(
  function WorkspaceSidePanel(
    { backdropRevision, children, className, closing, label, onExitComplete, radius, ...props },
    forwardedRef,
  ) {
    const motionRef = useRef<HTMLElement | null>(null);
    const presence = useSurfacePresence(motionRef, {
      effects: FadeSlideLeft,
      durationMs: WORKSPACE_SIDE_PANEL_PRESENCE_DURATION_MS,
      initialProgress: closing ? 1 : 0,
      contentTargets: () => materialContentChildren(motionRef.current),
      onComplete: (endpoint) => {
        if (endpoint === "hidden") onExitComplete?.();
      },
      onTransformWrite: (transform) => {
        const panel = motionRef.current;
        if (!panel) return;
        panel.style.willChange = transform ? "transform" : "";
        if (!transform) refreshMaterialSurfaceBackdrop(panel);
      },
    });
    useLayoutEffect(() => {
      if (closing) presence.hide();
      else presence.show();
    }, [closing, presence]);
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
        <div className="taskmap-workspace-side-panel__content">{children}</div>
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
  const renderOutgoingIndex =
    previousIndexRef.current !== activeIndex ? previousIndexRef.current : outgoingIndex;

  useLayoutEffect(() => {
    const activeView = viewRefs.current[activeIndex];
    if (!activeView) return;
    const previousIndex = previousIndexRef.current;
    previousIndexRef.current = activeIndex;
    if (previousIndex !== activeIndex) setOutgoingIndex(reducedMotion ? null : previousIndex);
    const nextHeight = measurePanelViewHeight(activeView);
    if (!heightInitializedRef.current) {
      heightInitializedRef.current = true;
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
        const outgoing = renderOutgoingIndex === index;
        if (!active && !outgoing) return null;
        const state = active ? "active" : "outgoing";
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

function materialContentChildren(surface: HTMLElement | null): HTMLElement[] {
  if (!surface) return [];
  const content = surface.querySelector<HTMLElement>(
    ":scope > .taskmap-workspace-side-panel__content",
  );
  return content ? [content] : [];
}
