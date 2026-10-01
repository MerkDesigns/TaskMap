export const MATERIAL_PRESENCE_PROGRESS_PROPERTY = "--taskmap-material-presence-progress";

export function writeMaterialPresenceProgress(surface: HTMLElement, progress: number): void {
  surface.style.setProperty(MATERIAL_PRESENCE_PROGRESS_PROPERTY, String(clampProgress(progress)));
}

export function clearMaterialPresenceProgress(surface: HTMLElement): void {
  surface.style.removeProperty(MATERIAL_PRESENCE_PROGRESS_PROPERTY);
}

/** Anything that renders glass; its material layers already follow the presence variable. */
const GLASS_SELECTOR =
  "[data-material-strategy], [data-native-filter-layer], [data-shared-small-glass-plane]";
const MATERIAL_LAYER_SELECTOR = '[class*="taskmap-material-native-glass__"]';
const PRESENCE_CONTENT_ATTRIBUTE = "data-material-presence-content";

/**
 * Marks the largest glass-free subtrees under `root` so CSS fades them with the inherited presence
 * variable: ordinary content fades without ever putting opacity on an ancestor of glass, which
 * would flatten its blur. Re-run when content changes during an animation; stale marks at rest are
 * harmless because the variable is 1 there.
 */
export function markMaterialPresenceContent(root: HTMLElement): void {
  for (const marked of root.querySelectorAll(`[${PRESENCE_CONTENT_ATTRIBUTE}]`)) {
    marked.removeAttribute(PRESENCE_CONTENT_ATTRIBUTE);
  }
  const visit = (parent: Element) => {
    for (const child of parent.children) {
      if (child.matches(MATERIAL_LAYER_SELECTOR)) continue;
      if (child.matches(GLASS_SELECTOR) || child.querySelector(GLASS_SELECTOR)) visit(child);
      else child.setAttribute(PRESENCE_CONTENT_ATTRIBUTE, "");
    }
  };
  visit(root);
}

function clampProgress(progress: number): number {
  if (!Number.isFinite(progress)) return 0;
  return Math.min(1, Math.max(0, progress));
}
