import { EXTENSIONS, type ExtensionId, type ExtensionTargetType } from "../../extensions/registry";

const REMOVED_EXTENSION_IDS = new Set<ExtensionId>([
  "sorting",
  "commandRunner",
  "dailyReset",
  "pickCard",
]);

export const RENDERER_V2_EXTENSIONS = EXTENSIONS.filter(
  (extension) => !REMOVED_EXTENSION_IDS.has(extension.id),
);
export const MAX_EXTENSION_FAVORITES = 5;
export const EXTENSION_FAVORITES_STORAGE_KEY = "taskmap.extensionFavorites";

export type ExtensionTargetFilter = ExtensionTargetType | "all";
export type ExtensionFavorites = Partial<Record<ExtensionId, boolean>>;

export function filterExtensions(query: string, target: ExtensionTargetFilter) {
  const normalized = query.trim().toLowerCase();
  return RENDERER_V2_EXTENSIONS.filter(
    (extension) =>
      (target === "all" || extension.targets.includes(target)) &&
      (!normalized ||
        [extension.label, extension.description, ...extension.targets]
          .join(" ")
          .toLowerCase()
          .includes(normalized)),
  );
}

export function toggleExtensionFavorite(
  favorites: ExtensionFavorites,
  extensionId: ExtensionId,
): ExtensionFavorites {
  if (favorites[extensionId]) return { ...favorites, [extensionId]: false };
  const count = RENDERER_V2_EXTENSIONS.filter((extension) => favorites[extension.id]).length;
  return count >= MAX_EXTENSION_FAVORITES ? favorites : { ...favorites, [extensionId]: true };
}

export function loadExtensionFavorites(): ExtensionFavorites {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(EXTENSION_FAVORITES_STORAGE_KEY) ?? "{}",
    ) as ExtensionFavorites;
    return Object.fromEntries(
      RENDERER_V2_EXTENSIONS.filter((extension) => parsed[extension.id])
        .slice(0, MAX_EXTENSION_FAVORITES)
        .map((extension) => [extension.id, true]),
    );
  } catch {
    return {};
  }
}
