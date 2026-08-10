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
}

export const CanvasBrowserCard = forwardRef<HTMLDivElement, CanvasBrowserCardProps>(
  function CanvasBrowserCard(
    { active = false, className, cycleHighlighted = false, embedded, mode, ...props },
    ref,
  ) {
    const radius = mode === "minimal" ? 8 : 12;
    return (
      <MaterialSurface
        {...props}
        ref={ref}
        material={embedded ? "opaque" : "acrylic-small"}
        radius={radius}
        data-canvas-card-mode={mode}
        data-active={active || undefined}
        data-cycle-highlighted={cycleHighlighted || undefined}
        className={primitiveClassNames(
          "taskmap-canvas-browser-card",
          `taskmap-canvas-browser-card--${mode}`,
          className,
        )}
      />
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
      radius={6}
      className={primitiveClassNames("taskmap-canvas-preview", className)}
    />
  );
});

/** Converts the DOM clone into a themed, fully opaque, unregistered drag representation. */
export function prepareCanvasBrowserDragPreview(clone: HTMLElement): void {
  clone.removeAttribute("data-material-surface-id");
  clone.removeAttribute("data-material");
  clone.setAttribute("data-material-strategy", "opaque");
  clone.setAttribute("aria-hidden", "true");
  clone.classList.add("taskmap-target-theme", "taskmap-canvas-browser-card--drag-preview");
  clone.style.removeProperty("transform");
  clone.style.removeProperty("transform-origin");
  clone.style.removeProperty("will-change");
  clone.style.setProperty("--taskmap-material-tint-opacity", "1");
}
