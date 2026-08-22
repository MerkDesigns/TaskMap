import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { MaterialCompositorPresentationSource } from "./materialCompositorPresentation";
import { createMaterialSurfaceRegistry } from "./materialSurfaceRegistry";
import { MaterialSurfaceRegistrationProvider } from "./MaterialSurfaceRegistration";

export interface MaterialCompositorProviderProps {
  readonly children: ReactNode;
  readonly presentation: MaterialCompositorPresentationSource;
}

/**
 * Retains the application-composition boundary while the legacy cached compositor is parked.
 * Native surfaces own their ResizeObserver geometry. The parked registry seam no longer fans
 * motion notifications out to every surface.
 */
export function MaterialCompositorProvider({ children }: MaterialCompositorProviderProps) {
  const [registry] = useState(() => createMaterialSurfaceRegistry());
  const notifySurfaceGeometryChanged = useCallback(() => {
    registry.refreshMeasurements();
  }, [registry]);
  const registrationBoundary = useMemo(
    () =>
      Object.freeze({
        registry,
        notifySurfaceGeometryChanged,
      }),
    [notifySurfaceGeometryChanged, registry],
  );

  useEffect(
    () => () => {
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
