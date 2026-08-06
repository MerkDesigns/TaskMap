import "./FrostedSurface.css";
import type { FrostedSurfaceProps } from "./frostedSurfaceTypes";

export const FROSTED_SURFACE_CLASS = "taskmap-frosted-surface";

export function FrostedSurface({ children, className, ...props }: FrostedSurfaceProps) {
  const rootClassName = className ? `${FROSTED_SURFACE_CLASS} ${className}` : FROSTED_SURFACE_CLASS;

  return (
    <div {...props} className={rootClassName}>
      {children}
    </div>
  );
}
