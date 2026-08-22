import { forwardRef, type HTMLAttributes } from "react";
import { MaterialSurface } from "../../materials/MaterialSurface";
import { LEFT_CHROME_GLASS_BATCH } from "./WorkspaceChromeGlassBatches";
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
  readonly radius?: number;
}

export const ToolbarGroup = forwardRef<HTMLElement, ToolbarGroupProps>(function ToolbarGroup(
  { className, label, radius, ...props },
  ref,
) {
  return (
    <MaterialSurface
      {...props}
      ref={ref}
      material="acrylic-large"
      backdropSource="shared"
      elevation="none"
      radius={radius}
      role="group"
      aria-label={label}
      data-glass-batch-target={LEFT_CHROME_GLASS_BATCH}
      className={["taskmap-floating-canvas-toolbar__group", className].filter(Boolean).join(" ")}
    />
  );
});
