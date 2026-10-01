import { forwardRef, useLayoutEffect, useRef, type HTMLAttributes } from "react";
import "../../theme/theme.css";
import "./WorkspaceRoot.css";
import { WorkspaceMajorGlass } from "../../materials/WorkspaceMajorGlass";
import { useReducedMotion } from "../../motion/reducedMotionPreference";
import { registerWorkspaceIntroCanvas, useWorkspaceIntroPhase } from "./workspaceIntro";

export const WorkspaceRoot = forwardRef<HTMLElement, HTMLAttributes<HTMLElement>>(
  function WorkspaceRoot({ className, ...props }, ref) {
    return (
      <main
        {...props}
        ref={ref}
        className={["taskmap-target-theme", "taskmap-workspace-root", className]
          .filter(Boolean)
          .join(" ")}
      />
    );
  },
);

export const WorkspaceChromeLayer = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function WorkspaceChromeLayer({ className, children, ...props }, ref) {
    return (
      <div
        {...props}
        ref={ref}
        className={["taskmap-workspace-chrome-layer", className].filter(Boolean).join(" ")}
      >
        <WorkspaceMajorGlass>{children}</WorkspaceMajorGlass>
      </div>
    );
  },
);

/** The canvas starts slightly zoomed in under the unlock screen and settles as it is revealed. */
const INTRO_CANVAS_SCALE = 1.08;
const INTRO_CANVAS_SETTLE = { duration: 900, easing: "cubic-bezier(0.16, 1, 0.3, 1)" } as const;
/** Locking zooms back in while the unlock screen settles over the canvas. */
const OUTRO_CANVAS_ZOOM = {
  duration: 650,
  easing: "cubic-bezier(0.65, 0, 0.35, 1)",
  fill: "forwards",
} as const;

export const WorkspaceBackdropLayer = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function WorkspaceBackdropLayer({ className, ...props }, ref) {
    const layerRef = useRef<HTMLDivElement | null>(null);
    const outroRef = useRef<Animation | null>(null);
    const intro = useWorkspaceIntroPhase();
    const reducedMotion = useReducedMotion();
    useLayoutEffect(() => registerWorkspaceIntroCanvas(), []);
    useLayoutEffect(() => {
      const layer = layerRef.current;
      if (!layer) return;
      if (intro === "departing") {
        if (!reducedMotion)
          outroRef.current =
            layer.animate?.(
              [{ transform: "scale(1)" }, { transform: `scale(${INTRO_CANVAS_SCALE})` }],
              OUTRO_CANVAS_ZOOM,
            ) ?? null;
        return;
      }
      // A cancelled lock (or the next reveal) starts from the canvas at rest.
      outroRef.current?.cancel();
      outroRef.current = null;
      if (intro === "covered" && !reducedMotion) {
        layer.style.transform = `scale(${INTRO_CANVAS_SCALE})`;
        return;
      }
      if (!layer.style.transform) return;
      layer.style.transform = "";
      if (intro !== "revealing" || reducedMotion) return;
      // Compositor-driven: the settle costs no main-thread frames and pointer work stays untouched.
      layer.animate?.(
        [{ transform: `scale(${INTRO_CANVAS_SCALE})` }, { transform: "scale(1)" }],
        INTRO_CANVAS_SETTLE,
      );
    }, [intro, reducedMotion]);
    return (
      <div
        {...props}
        ref={(node) => {
          layerRef.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
        }}
        className={["taskmap-workspace-backdrop-layer", className].filter(Boolean).join(" ")}
      />
    );
  },
);
