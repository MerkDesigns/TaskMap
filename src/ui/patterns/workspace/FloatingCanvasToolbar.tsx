import { forwardRef, useCallback, useRef, type ForwardedRef, type HTMLAttributes } from "react";
import { MaterialSurface } from "../../materials/MaterialSurface";
import { useChromeSleepMotion, type ChromeSleepCorner } from "./useChromeSleepMotion";
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
  /** The group supplies its own size (`supplyMaterialSurfaceSize`) instead of being observed. */
  readonly geometrySource?: "layout" | "owner";
  /** Where sleep mode flies the group out to; the window's top-left corner by default. */
  readonly sleepCorner?: ChromeSleepCorner;
  /**
   * For a group its owner opens and closes: it slides in when mounted and out when this turns
   * false, then reports `onClosed` so the owner can unmount it.
   */
  readonly open?: boolean;
  readonly onClosed?: () => void;
}

export const ToolbarGroup = forwardRef<HTMLElement, ToolbarGroupProps>(function ToolbarGroup(
  { className, label, radius, sleepCorner = "top-left", open, onClosed, ...props },
  forwardedRef,
) {
  const surfaceRef = useRef<HTMLElement | null>(null);
  useChromeSleepMotion(surfaceRef, sleepCorner, {
    intro: true,
    hidden: open === undefined ? undefined : !open,
    onHidden: onClosed,
  });
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
