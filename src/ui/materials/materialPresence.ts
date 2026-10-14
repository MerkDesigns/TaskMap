export const MATERIAL_PRESENCE_PROGRESS_PROPERTY = "--taskmap-material-presence-progress";
const MATERIAL_PRESENCE_DIRECT_PROPERTY = "--taskmap-material-presence-direct";

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

/**
 * Every material element whose own style reads the presence: native glass shadows, highlights,
 * rims and visible backdrop filters, marked content, scroll indicators and toggle tracks.
 */
const MATERIAL_PRESENCE_READER_SELECTOR = [
  '[data-material-strategy="native-glass"] > .taskmap-material-native-glass__shadow',
  '[data-material-strategy="native-glass"] .taskmap-material-native-glass__highlight',
  '[data-material-strategy="native-glass"] > .taskmap-material-native-glass__rim',
  '.taskmap-native-glass-recipe .taskmap-native-glass-backdrop:not([data-material-backdrop-source="shared"] *)',
  '.taskmap-native-glass-recipe .taskmap-native-glass-preblur[data-enabled="true"]:not([data-material-backdrop-source="shared"] *)',
  `[${PRESENCE_CONTENT_ATTRIBUTE}]`,
  ".taskmap-scroll-indicator",
  ".taskmap-liquid-toggle__track",
].join(", ");

export interface MaterialPresenceReaders {
  write(progress: number): void;
  clear(): void;
  destroy(): void;
}

/**
 * Writes presence straight onto the elements under `surface` that read it, through a non-inherited
 * property. The inherited presence variable restyles the surface's whole subtree on every frame,
 * previews and labels included; this restyles only the readers. `contentSelector` names the
 * surface's glass-free wrappers, which fade as marked content. Readers are collected again after
 * the subtree's children change.
 */
export function createMaterialPresenceReaders(
  surface: HTMLElement,
  contentSelector: string,
): MaterialPresenceReaders {
  let readers: HTMLElement[] | null = null;
  let written: readonly HTMLElement[] = [];
  const observer =
    typeof MutationObserver === "undefined"
      ? null
      : new MutationObserver(() => {
          readers = null;
        });
  observer?.observe(surface, { childList: true, subtree: true });
  const collect = () => {
    for (const content of surface.querySelectorAll(contentSelector)) {
      content.setAttribute(PRESENCE_CONTENT_ATTRIBUTE, "");
    }
    const found = [...surface.querySelectorAll<HTMLElement>(MATERIAL_PRESENCE_READER_SELECTOR)];
    if (surface.matches(MATERIAL_PRESENCE_READER_SELECTOR)) found.unshift(surface);
    return found;
  };
  const clear = () => {
    for (const reader of written) reader.style.removeProperty(MATERIAL_PRESENCE_DIRECT_PROPERTY);
    written = [];
  };
  return {
    write(progress) {
      // At rest readers follow the inherited value again.
      if (progress >= 1) {
        clear();
        return;
      }
      if (!readers) {
        clear();
        readers = collect();
      }
      const value = String(clampProgress(progress));
      for (const reader of readers) {
        reader.style.setProperty(MATERIAL_PRESENCE_DIRECT_PROPERTY, value);
      }
      written = readers;
    },
    clear,
    destroy() {
      observer?.disconnect();
      clear();
    },
  };
}

function clampProgress(progress: number): number {
  if (!Number.isFinite(progress)) return 0;
  return Math.min(1, Math.max(0, progress));
}
