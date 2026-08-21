import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { MaterialSurface } from "../../materials/MaterialSurface";
import { primitiveClassNames } from "../../primitives/primitiveClassNames";
import "./CanvasBrowserCard.css";

export type CanvasBrowserCardMode = "full" | "minimal" | "editor";

export interface CanvasBrowserCardProps extends HTMLAttributes<HTMLDivElement> {
  readonly active?: boolean;
  readonly cycleHighlighted?: boolean;
  readonly embedded: boolean;
  readonly mode: CanvasBrowserCardMode;
  readonly radius?: number;
}

export const CanvasBrowserCard = forwardRef<HTMLDivElement, CanvasBrowserCardProps>(
  function CanvasBrowserCard(
    {
      active = false,
      children,
      className,
      cycleHighlighted = false,
      embedded,
      mode,
      radius: radiusOverride,
      ...props
    },
    ref,
  ) {
    const radius = radiusOverride ?? (mode === "minimal" ? 8 : undefined);
    return (
      <MaterialSurface
        {...props}
        ref={ref}
        material={embedded ? "opaque" : "acrylic-small"}
        radius={radius}
        data-canvas-card-mode={mode}
        data-active={active || undefined}
        data-cycle-highlighted={cycleHighlighted || undefined}
        aria-current={active ? "true" : undefined}
        className={primitiveClassNames(
          "taskmap-canvas-browser-card",
          `taskmap-canvas-browser-card--${mode}`,
          className,
        )}
      >
        <div className="taskmap-canvas-browser-card__content-mask">
          <div className="taskmap-canvas-browser-card__content">{children}</div>
        </div>
      </MaterialSurface>
    );
  },
);

export interface CanvasPreviewProps extends HTMLAttributes<HTMLDivElement> {
  readonly children?: ReactNode;
}

export const CanvasPreview = forwardRef<HTMLDivElement, CanvasPreviewProps>(function CanvasPreview(
  { className, ...props },
  ref,
) {
  return (
    <MaterialSurface
      {...props}
      ref={ref}
      material="cutout"
      radius={8}
      className={primitiveClassNames("taskmap-canvas-preview", className)}
    />
  );
});
