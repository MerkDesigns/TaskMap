import { forwardRef, useCallback, useRef, type ForwardedRef, type HTMLAttributes } from "react";
import { MaterialSurface } from "../../materials/MaterialSurface";
import { useMinimapVisibilityMotion } from "./useMinimapVisibilityMotion";
import "./MinimapSurface.css";

export interface MinimapSurfaceProps extends HTMLAttributes<HTMLElement> {
  readonly visible: boolean;
}

export const MinimapSurface = forwardRef<HTMLElement, MinimapSurfaceProps>(function MinimapSurface(
  { className, visible, ...props },
  forwardedRef,
) {
  const surfaceRef = useRef<HTMLElement | null>(null);
  useMinimapVisibilityMotion(surfaceRef, visible);
  const composedRef = useCallback(
    (element: HTMLElement | null) => {
      surfaceRef.current = element;
      assignRef(forwardedRef, element);
    },
    [forwardedRef],
  );

  return (
    <MaterialSurface
      {...props}
      ref={composedRef}
      material="acrylic-large"
      radius={12}
      aria-label="Minimap"
      data-visible={visible}
      className={["taskmap-minimap-surface", className].filter(Boolean).join(" ")}
    />
  );
});

export const MinimapViewport = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function MinimapViewport({ className, ...props }, ref) {
    return (
      <MaterialSurface
        {...props}
        ref={ref}
        material="cutout"
        radius={6}
        elevation="none"
        className={["taskmap-minimap-viewport", className].filter(Boolean).join(" ")}
      />
    );
  },
);

function assignRef(ref: ForwardedRef<HTMLElement>, element: HTMLElement | null): void {
  if (typeof ref === "function") ref(element);
  else if (ref) ref.current = element;
}
