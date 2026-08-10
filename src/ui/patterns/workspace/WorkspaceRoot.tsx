import { forwardRef, type HTMLAttributes } from "react";
import "../../theme/theme.css";
import "./WorkspaceRoot.css";

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
  function WorkspaceChromeLayer({ className, ...props }, ref) {
    return (
      <div
        {...props}
        ref={ref}
        className={["taskmap-workspace-chrome-layer", className].filter(Boolean).join(" ")}
      />
    );
  },
);

export const WorkspaceBackdropLayer = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function WorkspaceBackdropLayer({ className, ...props }, ref) {
    return (
      <div
        {...props}
        ref={ref}
        className={["taskmap-workspace-backdrop-layer", className].filter(Boolean).join(" ")}
      />
    );
  },
);
