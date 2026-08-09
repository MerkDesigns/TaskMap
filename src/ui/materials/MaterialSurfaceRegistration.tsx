import { createContext, useContext } from "react";
import type { MaterialSurfaceRegistry } from "./materialSurfaceRegistry";

export interface MaterialSurfaceRegistrationBoundary {
  readonly registry: MaterialSurfaceRegistry;
  readonly notifySurfaceGeometryChanged: () => void;
}

const MaterialSurfaceRegistrationContext =
  createContext<MaterialSurfaceRegistrationBoundary | null>(null);

export const MaterialSurfaceRegistrationProvider = MaterialSurfaceRegistrationContext.Provider;

export function useMaterialSurfaceRegistry(): MaterialSurfaceRegistry | null {
  return useContext(MaterialSurfaceRegistrationContext)?.registry ?? null;
}

/** Explicit cheap invalidation seam for transform-driven material motion. */
export function useMaterialSurfaceGeometryInvalidation(): () => void {
  return useContext(MaterialSurfaceRegistrationContext)?.notifySurfaceGeometryChanged ?? noOp;
}

const noOp = () => undefined;
