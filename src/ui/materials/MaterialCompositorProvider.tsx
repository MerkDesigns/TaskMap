import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { MaterialCompositorPresentationSource } from "./materialCompositorPresentation";
import { createMaterialSurfaceRegistry } from "./materialSurfaceRegistry";
import { MaterialSurfaceRegistrationProvider } from "./MaterialSurfaceRegistration";

export interface MaterialCompositorProviderProps {
  readonly children: ReactNode;
  readonly presentation: MaterialCompositorPresentationSource;
}

/**
 * Retains the application-composition boundary while the legacy cached compositor is parked.
 * Native glass surfaces subscribe only to cheap geometry invalidations from existing UI motion.
 */
export function MaterialCompositorProvider({ children }: MaterialCompositorProviderProps) {
  const [registry] = useState(() => createMaterialSurfaceRegistry());
  const geometryListenersRef = useRef(new Set<() => void>());
  const notifySurfaceGeometryChanged = useCallback(() => {
    for (const listener of geometryListenersRef.current) listener();
  }, []);
  const subscribeSurfaceGeometryChanged = useCallback((listener: () => void) => {
    geometryListenersRef.current.add(listener);
    return () => {
      geometryListenersRef.current.delete(listener);
    };
  }, []);
  const registrationBoundary = useMemo(
    () =>
      Object.freeze({
        registry,
        notifySurfaceGeometryChanged,
        subscribeSurfaceGeometryChanged,
      }),
    [notifySurfaceGeometryChanged, registry, subscribeSurfaceGeometryChanged],
  );

  useEffect(
    () => () => {
      geometryListenersRef.current.clear();
      registry.dispose();
    },
    [registry],
  );

  return (
    <MaterialSurfaceRegistrationProvider value={registrationBoundary}>
      {children}
    </MaterialSurfaceRegistrationProvider>
  );
}
