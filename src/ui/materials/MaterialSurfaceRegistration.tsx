import { createContext, useCallback, useContext, type RefObject } from "react";
import type { MaterialSurfaceElement, MaterialSurfaceRegistry } from "./materialSurfaceRegistry";

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

/** Imperative cheap mask-only presentation seam for compositor-backed surface fades. */
export function useMaterialSurfaceMaskOpacity(
  surfaceRef: RefObject<MaterialSurfaceElement | null>,
): (opacity: number) => void {
  const registry = useContext(MaterialSurfaceRegistrationContext)?.registry ?? null;
  return useCallback(
    (opacity: number) => {
      const element = surfaceRef.current;
      if (element) registry?.updateMaskOpacity(element, opacity);
    },
    [registry, surfaceRef],
  );
}

const noOp = () => undefined;
