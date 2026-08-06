import type { HTMLAttributes, ReactNode } from "react";

export interface FrostedSurfaceProps extends HTMLAttributes<HTMLDivElement> {
  readonly children: ReactNode;
}
