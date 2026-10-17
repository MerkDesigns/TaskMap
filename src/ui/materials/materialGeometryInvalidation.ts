import type { MaterialSize } from "./materialGeometryScheduler";

const surfaceInvalidations = new WeakMap<HTMLElement, Set<() => void>>();
const ownedSizes = new WeakMap<HTMLElement, MaterialSize>();
const ownedSizeWriters = new WeakMap<
  HTMLElement,
  (size: MaterialSize) => (() => void) | undefined
>();
const MATERIAL_TUNING_CHANGE_EVENT = "taskmap:material-tuning-change";

export interface MaterialPresentation {
  readonly translateX: number;
  readonly translateY: number;
  /** Uniform scale around the surface centre (CSS default transform origin). */
  readonly scale: number;
  readonly opacity: number;
  /** Only this many px from the top are shown (`writeMaterialReveal`); absent shows it all. */
  readonly visibleHeight?: number;
}
const IDENTITY_PRESENTATION: MaterialPresentation = {
  translateX: 0,
  translateY: 0,
  scale: 1,
  opacity: 1,
};
const presentations = new WeakMap<HTMLElement, MaterialPresentation>();
const presentationWriters = new WeakMap<HTMLElement, () => void>();
export function readMaterialPresentation(surface: HTMLElement): MaterialPresentation {
  return presentations.get(surface) ?? IDENTITY_PRESENTATION;
}
/** Motion owners project cached geometry; this path performs no layout reads. */
export function supplyMaterialPresentation(
  surface: HTMLElement,
  value: Partial<MaterialPresentation>,
): void {
  presentations.set(surface, { ...readMaterialPresentation(surface), ...value });
  presentationWriters.get(surface)?.();
}
/**
 * Shows only the top `visible` px of a surface laid out `full` px tall. The element is clipped and
 * shared glass planes draw the same rounded silhouette from cached cap images, so animating a
 * reveal never relayouts, remeasures or re-encodes a mask the way animating height does.
 */
export function writeMaterialReveal(surface: HTMLElement, visible: number, full: number): void {
  const hidden = Math.max(0, full - visible);
  surface.style.clipPath =
    hidden > 0 ? `inset(0 0 ${hidden}px 0 round var(--taskmap-material-radius))` : "";
  // Kept even when nothing is hidden: right after the owner shrinks the layout to `visible`, the
  // plane still holds the old, taller shape until the next geometry pass.
  supplyMaterialPresentation(surface, { visibleHeight: visible });
}
export function subscribeMaterialPresentation(surface: HTMLElement, write: () => void): () => void {
  presentationWriters.set(surface, write);
  return () => {
    presentationWriters.delete(surface);
  };
}

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
