import { forwardRef, type HTMLAttributes } from "react";
import { MaterialSurface } from "../../materials/MaterialSurface";
import "./FloatingCanvasToolbar.css";

export const FloatingCanvasToolbar = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function FloatingCanvasToolbar({ className, ...props }, ref) {
    return (
      <div
        {...props}
        ref={ref}
        className={["taskmap-floating-canvas-toolbar", className].filter(Boolean).join(" ")}
      />
    );
  },
);

export interface ToolbarGroupProps extends HTMLAttributes<HTMLElement> {
  readonly label: string;
}

export const ToolbarGroup = forwardRef<HTMLElement, ToolbarGroupProps>(function ToolbarGroup(
  { className, label, ...props },
  ref,
) {
  return (
    <MaterialSurface
      {...props}
      ref={ref}
      material="acrylic-large"
      elevation="none"
      role="group"
      aria-label={label}
      className={["taskmap-floating-canvas-toolbar__group", className].filter(Boolean).join(" ")}
    />
  );
});
