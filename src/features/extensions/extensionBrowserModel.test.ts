import { describe, expect, it } from "vitest";
import {
  filterExtensions,
  MAX_EXTENSION_FAVORITES,
  RENDERER_V2_EXTENSIONS,
  toggleExtensionFavorite,
} from "./extensionBrowserModel";

describe("extensionBrowserModel", () => {
  it("excludes removed extensions and filters by query and target", () => {
    expect(RENDERER_V2_EXTENSIONS.map(({ id }) => id)).not.toContain("sorting");
    expect(filterExtensions("blur", "container").map(({ id }) => id)).toEqual(["privacy"]);
    expect(filterExtensions("lock", "image").map(({ id }) => id)).toContain("lock");
  });

  it("enforces the five-favorite limit", () => {
    let favorites = {};
    for (const extension of RENDERER_V2_EXTENSIONS.slice(0, MAX_EXTENSION_FAVORITES)) {
      favorites = toggleExtensionFavorite(favorites, extension.id);
    }
    const extra = RENDERER_V2_EXTENSIONS[MAX_EXTENSION_FAVORITES];
    expect(extra).toBeDefined();
    expect(toggleExtensionFavorite(favorites, extra!.id)).toBe(favorites);
  });
});
