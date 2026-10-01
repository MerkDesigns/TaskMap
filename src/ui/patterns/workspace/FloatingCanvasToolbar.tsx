import { forwardRef, useCallback, useRef, type ForwardedRef, type HTMLAttributes } from "react";
import { MaterialSurface } from "../../materials/MaterialSurface";
import { useChromeSleepMotion } from "./useChromeSleepMotion";
import "./ChromeControlGroup.css";
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
  forwardedRef,
) {
  const surfaceRef = useRef<HTMLElement | null>(null);
  useChromeSleepMotion(surfaceRef, "top-left", { intro: true });
  const ref = useCallback(
    (element: HTMLElement | null) => {
      surfaceRef.current = element;
      assignRef(forwardedRef, element);
    },
    [forwardedRef],
  );
  return (
    <MaterialSurface
      {...props}
      ref={ref}
      material="acrylic-large"
      elevation="none"
      radius={radius}
      role="group"
      aria-label={label}
      className={[
        "taskmap-chrome-control-group",
        "taskmap-floating-canvas-toolbar__group",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    />
  );
});

function assignRef(ref: ForwardedRef<HTMLElement>, element: HTMLElement | null): void {
  if (typeof ref === "function") ref(element);
  else if (ref) ref.current = element;
}
