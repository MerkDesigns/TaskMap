import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  type ReactNode,
  type RefObject,
} from "react";
import type { MaterialSurfaceElement, MaterialSurfaceRegistry } from "./materialSurfaceRegistry";

export interface MaterialSurfaceRegistrationBoundary {
  readonly registry: MaterialSurfaceRegistry;
  readonly notifySurfaceGeometryChanged: () => void;
  readonly subscribeSurfaceGeometryChanged?: (listener: () => void) => () => void;
}

const MaterialSurfaceRegistrationContext =
  createContext<MaterialSurfaceRegistrationBoundary | null>(null);
export interface MaterialSurfaceMaskOpacityGroup {
  readonly localOpacityRef: RefObject<number>;
  readonly parent: MaterialSurfaceMaskOpacityGroup | null;
}

const MaterialSurfaceGroupMaskOpacityContext =
  createContext<MaterialSurfaceMaskOpacityGroup | null>(null);
const opacityGroupBySurface = new WeakMap<
  MaterialSurfaceElement,
  MaterialSurfaceMaskOpacityGroup
>();

export const MaterialSurfaceRegistrationProvider = MaterialSurfaceRegistrationContext.Provider;

export function MaterialSurfaceGroupMaskOpacityProvider({
  children,
  group,
}: {
  readonly children: ReactNode;
  readonly group: MaterialSurfaceMaskOpacityGroup;
}) {
  return (
    <MaterialSurfaceGroupMaskOpacityContext.Provider value={group}>
      {children}
    </MaterialSurfaceGroupMaskOpacityContext.Provider>
  );
}

export function useMaterialSurfaceRegistry(): MaterialSurfaceRegistry | null {
  return useContext(MaterialSurfaceRegistrationContext)?.registry ?? null;
}

export function useMaterialSurfaceMaskOpacityGroup(
  localOpacityRef: RefObject<number>,
): MaterialSurfaceMaskOpacityGroup {
  const parent = useContext(MaterialSurfaceGroupMaskOpacityContext);
  return useMemo(() => ({ localOpacityRef, parent }), [localOpacityRef, parent]);
}

export function useInheritedMaterialSurfaceMaskOpacityGroup(): MaterialSurfaceMaskOpacityGroup | null {
  return useContext(MaterialSurfaceGroupMaskOpacityContext);
}

export function resolveMaterialSurfaceMaskOpacity(
  group: MaterialSurfaceMaskOpacityGroup | null,
): number {
  let opacity = 1;
  let current = group;
  while (current) {
    opacity *= normalizeMaskOpacity(current.localOpacityRef.current ?? 1);
    current = current.parent;
  }
  return normalizeMaskOpacity(opacity);
}

export function associateMaterialSurfaceMaskOpacityGroup(
  element: MaterialSurfaceElement,
  group: MaterialSurfaceMaskOpacityGroup | null,
): void {
  if (group) opacityGroupBySurface.set(element, group);
  else opacityGroupBySurface.delete(element);
}

export function clearMaterialSurfaceMaskOpacityGroup(element: MaterialSurfaceElement): void {
  opacityGroupBySurface.delete(element);
}

/** Explicit cheap invalidation seam for transform-driven material motion. */
export function useMaterialSurfaceGeometryInvalidation(): () => void {
  return useContext(MaterialSurfaceRegistrationContext)?.notifySurfaceGeometryChanged ?? noOp;
}

export function useMaterialSurfaceGeometrySubscription(listener: () => void): void {
  const subscribe = useContext(MaterialSurfaceRegistrationContext)?.subscribeSurfaceGeometryChanged;
  useLayoutEffect(() => subscribe?.(listener), [listener, subscribe]);
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

/** Batched cheap mask-only seam for a DOM presentation group containing acrylic descendants. */
export function useMaterialSurfaceGroupMaskOpacity(
  groupRef: RefObject<HTMLElement | null>,
): () => void {
  const registry = useContext(MaterialSurfaceRegistrationContext)?.registry ?? null;
  return useCallback(() => {
    const group = groupRef.current;
    if (!group || !registry) return;
    const updates = registry
      .getSnapshot()
      .surfaces.filter((surface) => group.contains(surface.element as unknown as Node))
      .map((surface) => ({
        element: surface.element,
        maskOpacity: resolveMaterialSurfaceMaskOpacity(
          opacityGroupBySurface.get(surface.element) ?? null,
        ),
      }));
    registry.updateMaskOpacitiesBatch(updates);
  }, [groupRef, registry]);
}

function normalizeMaskOpacity(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(0, Math.min(1, value));
}

const noOp = () => undefined;
