import type { CanvasRectangle } from "../../canvas/geometry/canvasGeometry";
import type { MaterialId, MaterialPlane } from "./materialTypes";

export const MAX_REGISTERED_MATERIAL_SURFACES = 2_048;

export interface MaterialSurfaceElement {
  readonly isConnected: boolean;
  getBoundingClientRect(): {
    readonly left: number;
    readonly top: number;
    readonly width: number;
    readonly height: number;
  };
}

export interface MaterialSurfaceRegistration {
  readonly id: string;
  readonly element: MaterialSurfaceElement;
  readonly material: MaterialId;
  readonly plane: MaterialPlane;
  readonly radiusPx: number;
}

export interface RegisteredMaterialSurface extends MaterialSurfaceRegistration {
  readonly bounds: CanvasRectangle;
  readonly visible: boolean;
}

export interface MaterialSurfaceRegistrySnapshot {
  readonly revision: number;
  readonly planeRevisions: Readonly<Record<MaterialPlane, number>>;
  readonly surfaces: readonly RegisteredMaterialSurface[];
}

export interface SharedSurfaceResizeObserver {
  observe(element: MaterialSurfaceElement): void;
  unobserve(element: MaterialSurfaceElement): void;
  disconnect(): void;
}

export type CreateSharedSurfaceResizeObserver = (
  onResize: (elements: readonly MaterialSurfaceElement[]) => void,
) => SharedSurfaceResizeObserver;

export interface MaterialSurfaceRegistry {
  register(registration: MaterialSurfaceRegistration): () => void;
  update(registration: MaterialSurfaceRegistration): void;
  refreshMeasurements(): void;
  getSnapshot(): MaterialSurfaceRegistrySnapshot;
  subscribe(listener: () => void): () => void;
  dispose(): void;
}

export function createMaterialSurfaceRegistry(
  createObserver: CreateSharedSurfaceResizeObserver | null = browserResizeObserverFactory(),
): MaterialSurfaceRegistry {
  let disposed = false;
  let revision = 0;
  const planeRevisions: Record<MaterialPlane, number> = { base: 0, modal: 0 };
  const entries = new Map<string, RegisteredMaterialSurface>();
  const idsByElement = new Map<MaterialSurfaceElement, string>();
  const listeners = new Set<() => void>();
  const observer = createObserver?.((elements) => {
    let changed = false;
    for (const element of elements) {
      const id = idsByElement.get(element);
      if (id) changed = measureEntry(id) || changed;
    }
    if (changed) publish();
  });

  const markPlanes = (...planes: readonly MaterialPlane[]) => {
    revision += 1;
    new Set(planes).forEach((plane) => {
      planeRevisions[plane] += 1;
    });
  };

  const publish = () => listeners.forEach((listener) => listener());

  function measureEntry(id: string): boolean {
    const current = entries.get(id);
    if (!current) return false;
    const next = withMeasurement(current);
    if (sameGeometry(current, next)) return false;
    entries.set(id, next);
    markPlanes(current.plane);
    return true;
  }

  const unregister = (id: string, element: MaterialSurfaceElement) => {
    if (disposed) return;
    const current = entries.get(id);
    if (!current || current.element !== element) return;
    entries.delete(id);
    idsByElement.delete(element);
    observer?.unobserve(element);
    markPlanes(current.plane);
    publish();
  };

  return Object.freeze({
    register(registration: MaterialSurfaceRegistration) {
      if (disposed) return () => undefined;
      if (!registration.id.trim()) throw new RangeError("Material surface ID must not be empty");
      if (!Number.isFinite(registration.radiusPx) || registration.radiusPx < 0) {
        throw new RangeError("Material surface radius must be finite and non-negative");
      }
      const existing = entries.get(registration.id);
      if (existing && existing.element !== registration.element) {
        throw new Error(`Material surface ID is already registered: ${registration.id}`);
      }
      if (!existing && entries.size >= MAX_REGISTERED_MATERIAL_SURFACES) {
        throw new RangeError(
          `Material surface registry exceeds ${MAX_REGISTERED_MATERIAL_SURFACES}`,
        );
      }
      if (existing) {
        this.update(registration);
        return () => unregister(registration.id, registration.element);
      }
      const entry = withMeasurement(registration);
      entries.set(registration.id, entry);
      idsByElement.set(registration.element, registration.id);
      observer?.observe(registration.element);
      markPlanes(registration.plane);
      publish();
      return () => unregister(registration.id, registration.element);
    },
    update(registration: MaterialSurfaceRegistration) {
      if (disposed) return;
      const current = entries.get(registration.id);
      if (!current || current.element !== registration.element) return;
      const next = withMeasurement(registration);
      const planeChanged = current.plane !== next.plane;
      const maskChanged =
        planeChanged || current.radiusPx !== next.radiusPx || !sameGeometry(current, next);
      const materialChanged = current.material !== next.material;
      if (!maskChanged && !materialChanged) return;
      entries.set(registration.id, next);
      if (maskChanged) {
        markPlanes(current.plane, next.plane);
        publish();
      }
    },
    refreshMeasurements() {
      if (disposed) return;
      let changed = false;
      for (const id of entries.keys()) changed = measureEntry(id) || changed;
      if (changed) publish();
    },
    getSnapshot() {
      return Object.freeze({
        revision,
        planeRevisions: Object.freeze({ ...planeRevisions }),
        surfaces: Object.freeze([...entries.values()]),
      });
    },
    subscribe(listener: () => void) {
      if (disposed) return () => undefined;
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      observer?.disconnect();
      entries.clear();
      idsByElement.clear();
      listeners.clear();
    },
  });
}

function withMeasurement(registration: MaterialSurfaceRegistration): RegisteredMaterialSurface {
  const rectangle = registration.element.getBoundingClientRect();
  const bounds = Object.freeze({
    x: finite(rectangle.left),
    y: finite(rectangle.top),
    width: Math.max(0, finite(rectangle.width)),
    height: Math.max(0, finite(rectangle.height)),
  });
  return Object.freeze({
    ...registration,
    bounds,
    visible: registration.element.isConnected && bounds.width > 0 && bounds.height > 0,
  });
}

function sameGeometry(left: RegisteredMaterialSurface, right: RegisteredMaterialSurface): boolean {
  return (
    left.visible === right.visible &&
    left.bounds.x === right.bounds.x &&
    left.bounds.y === right.bounds.y &&
    left.bounds.width === right.bounds.width &&
    left.bounds.height === right.bounds.height
  );
}

function finite(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function browserResizeObserverFactory(): CreateSharedSurfaceResizeObserver | null {
  if (typeof ResizeObserver === "undefined") return null;
  return (onResize) => {
    const observer = new ResizeObserver((entries) =>
      onResize(entries.map((entry) => entry.target as MaterialSurfaceElement)),
    );
    return {
      observe: (element) => observer.observe(element as Element),
      unobserve: (element) => observer.unobserve(element as Element),
      disconnect: () => observer.disconnect(),
    };
  };
}
