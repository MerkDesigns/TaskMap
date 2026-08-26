export const MATERIAL_PRESENCE_PROGRESS_PROPERTY = "--taskmap-material-presence-progress";

export function writeMaterialPresenceProgress(surface: HTMLElement, progress: number): void {
  surface.style.setProperty(MATERIAL_PRESENCE_PROGRESS_PROPERTY, String(clampProgress(progress)));
}

export function clearMaterialPresenceProgress(surface: HTMLElement): void {
  surface.style.removeProperty(MATERIAL_PRESENCE_PROGRESS_PROPERTY);
}

function clampProgress(progress: number): number {
  if (!Number.isFinite(progress)) return 0;
  return Math.min(1, Math.max(0, progress));
}
