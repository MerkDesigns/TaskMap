import type { ReactNode } from "react";
import type { MaterialCompositorPresentationSource } from "./materialCompositorPresentation";

export interface MaterialCompositorProviderProps {
  readonly children: ReactNode;
  readonly presentation?: MaterialCompositorPresentationSource;
}

/**
 * Retains the application-composition boundary while the legacy cached compositor is parked.
 * Native geometry is centrally scheduled; production allocates no cached registry or runtime.
 * The optional presentation prop is retained only for parked development callers.
 */
export function MaterialCompositorProvider({ children }: MaterialCompositorProviderProps) {
  return children;
}
