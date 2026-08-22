const MATERIAL_GEOMETRY_INVALIDATION_EVENT = "taskmap:material-geometry-invalidate";
const MATERIAL_TUNING_CHANGE_EVENT = "taskmap:material-tuning-change";

export function invalidateMaterialSurfaceGeometry(surface: HTMLElement): void {
  surface.dispatchEvent(new Event(MATERIAL_GEOMETRY_INVALIDATION_EVENT));
}

export function refreshMaterialSurfaceBackdrop(surface: HTMLElement): void {
  const current = surface.style.getPropertyValue("--taskmap-material-backdrop-revision");
  surface.style.setProperty(
    "--taskmap-material-backdrop-revision",
    current === "0.01px" ? "0px" : "0.01px",
  );
  invalidateMaterialSurfaceGeometry(surface);
}

export function subscribeMaterialSurfaceGeometryInvalidation(
  surface: HTMLElement,
  refresh: () => void,
): () => void {
  surface.addEventListener(MATERIAL_GEOMETRY_INVALIDATION_EVENT, refresh);
  return () => surface.removeEventListener(MATERIAL_GEOMETRY_INVALIDATION_EVENT, refresh);
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
