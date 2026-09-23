import type { MaterialSize } from "./materialGeometryScheduler";

const surfaceInvalidations = new WeakMap<HTMLElement, Set<() => void>>();
const ownedSizes = new WeakMap<HTMLElement, MaterialSize>();
const ownedSizeWriters = new WeakMap<
  HTMLElement,
  (size: MaterialSize) => (() => void) | undefined
>();
const MATERIAL_TUNING_CHANGE_EVENT = "taskmap:material-tuning-change";

export function invalidateMaterialSurfaceGeometry(surface: HTMLElement): void {
  surfaceInvalidations.get(surface)?.forEach((refresh) => refresh());
}

/** Returns a measurement-free material write for the owner's write phase. */
export function supplyMaterialSurfaceSize(
  surface: HTMLElement,
  size: MaterialSize,
): (() => void) | undefined {
  const previous = ownedSizes.get(surface);
  if (previous?.width === size.width && previous.height === size.height) return;
  ownedSizes.set(surface, size);
  const write = ownedSizeWriters.get(surface)?.(size);
  if (write) return write;
  invalidateMaterialSurfaceGeometry(surface);
}

export function subscribeMaterialSurfaceSize(
  surface: HTMLElement,
  prepareWrite: (size: MaterialSize) => (() => void) | undefined,
): () => void {
  ownedSizeWriters.set(surface, prepareWrite);
  return () => {
    ownedSizeWriters.delete(surface);
  };
}

export function readSuppliedMaterialSurfaceSize(surface: HTMLElement): MaterialSize | undefined {
  return ownedSizes.get(surface);
}

export function refreshMaterialSurfaceBackdrop(surface: HTMLElement): void {
  // Native backdrop invalidation follows real scene/style changes. This bounded settlement
  // request only refreshes sampling bounds; it never perturbs the transform or material optics.
  invalidateMaterialSurfaceGeometry(surface);
}

export function subscribeMaterialSurfaceGeometryInvalidation(
  surface: HTMLElement,
  refresh: () => void,
): () => void {
  let listeners = surfaceInvalidations.get(surface);
  if (!listeners) {
    listeners = new Set();
    surfaceInvalidations.set(surface, listeners);
  }
  listeners.add(refresh);
  return () => {
    listeners.delete(refresh);
  };
}

export function notifyMaterialTuningChanged(): void {
  if (typeof document !== "undefined") {
    document.dispatchEvent(new Event(MATERIAL_TUNING_CHANGE_EVENT));
  }
}

export function subscribeMaterialTuningChanged(refresh: () => void): () => void {
  if (typeof document === "undefined") return () => undefined;
  document.addEventListener(MATERIAL_TUNING_CHANGE_EVENT, refresh);
  return () => document.removeEventListener(MATERIAL_TUNING_CHANGE_EVENT, refresh);
}
