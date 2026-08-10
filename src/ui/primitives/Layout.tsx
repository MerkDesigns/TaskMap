import { forwardRef, type CSSProperties, type HTMLAttributes } from "react";
import { MaterialSurface } from "../materials/MaterialSurface";
import type { MaterialId } from "../materials/materialTypes";
import { primitiveClassNames } from "./primitiveClassNames";
import "./layout.css";

export interface SurfaceContainerProps extends HTMLAttributes<HTMLElement> {
  readonly material?: MaterialId;
  readonly radius?: number;
}

export const Panel = forwardRef<HTMLElement, SurfaceContainerProps>(function Panel(
  { children, className, material, radius, ...props },
  ref,
) {
  const resolvedClassName = primitiveClassNames("taskmap-panel", className);
  return material ? (
    <MaterialSurface
      {...props}
      ref={ref}
      material={material}
      radius={radius}
      as="section"
      className={resolvedClassName}
    >
      {children}
    </MaterialSurface>
  ) : (
    <section {...props} ref={ref} className={resolvedClassName}>
      {children}
    </section>
  );
});

export const Card = forwardRef<HTMLElement, SurfaceContainerProps>(function Card(
  { children, className, material, radius, ...props },
  ref,
) {
  const resolvedClassName = primitiveClassNames("taskmap-card", className);
  return material ? (
    <MaterialSurface
      {...props}
      ref={ref}
      material={material}
      radius={radius}
      as="section"
      className={resolvedClassName}
    >
      {children}
    </MaterialSurface>
  ) : (
    <section {...props} ref={ref} className={resolvedClassName}>
      {children}
    </section>
  );
});

interface FlowProps extends HTMLAttributes<HTMLDivElement> {
  readonly gap?: "small" | "normal" | "large";
  readonly align?: CSSProperties["alignItems"];
  readonly justify?: CSSProperties["justifyContent"];
}

export interface ScrollAreaProps extends HTMLAttributes<HTMLDivElement> {
  readonly hiddenScrollbar?: boolean;
}

export const ScrollArea = forwardRef<HTMLDivElement, ScrollAreaProps>(function ScrollArea(
  { className, hiddenScrollbar = false, ...props },
  ref,
) {
  return (
    <div
      {...props}
      ref={ref}
      className={primitiveClassNames(
        "taskmap-scroll-area",
        hiddenScrollbar && "taskmap-scroll-area--hidden-scrollbar",
        className,
      )}
    />
  );
});

export const Stack = forwardRef<HTMLDivElement, FlowProps>(function Stack(
  { align, className, gap = "normal", justify, style, ...props },
  ref,
) {
  return (
    <div
      {...props}
      ref={ref}
      className={primitiveClassNames("taskmap-stack", `taskmap-flow--${gap}`, className)}
      style={{ ...style, alignItems: align, justifyContent: justify }}
    />
  );
});

export const Inline = forwardRef<HTMLDivElement, FlowProps>(function Inline(
  { align = "center", className, gap = "normal", justify, style, ...props },
  ref,
) {
  return (
    <div
      {...props}
      ref={ref}
      className={primitiveClassNames("taskmap-inline", `taskmap-flow--${gap}`, className)}
      style={{ ...style, alignItems: align, justifyContent: justify }}
    />
  );
});

export const Divider = forwardRef<HTMLHRElement, HTMLAttributes<HTMLHRElement>>(function Divider(
  { className, ...props },
  ref,
) {
  return <hr {...props} ref={ref} className={primitiveClassNames("taskmap-divider", className)} />;
});
