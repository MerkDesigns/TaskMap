import { createElement, forwardRef, type CSSProperties, type HTMLAttributes } from "react";
import { MaterialSurface } from "../../ui/materials/MaterialSurface";
import { resolveSurfaceMaterial, type SurfaceMaterial } from "./Material";

export interface SurfaceProps extends HTMLAttributes<HTMLElement> {
  readonly material?: SurfaceMaterial;
  readonly radius?: number;
}

export const Surface = forwardRef<HTMLElement, SurfaceProps>(function Surface(
  { children, className, material, radius, style, ...props },
  ref,
) {
  const surfaceClassName = ["taskmap-ui-lab-surface", className].filter(Boolean).join(" ");
  const surfaceStyle: CSSProperties | undefined =
    radius === undefined ? style : { ...style, borderRadius: radius };

  if (material) {
    return (
      <MaterialSurface
        {...props}
        ref={ref}
        className={surfaceClassName}
        material={resolveSurfaceMaterial(material)}
        radius={radius}
        style={surfaceStyle}
      >
        {children}
      </MaterialSurface>
    );
  }

  return createElement(
    "div",
    { ...props, ref, className: surfaceClassName, style: surfaceStyle },
    children,
  );
});
