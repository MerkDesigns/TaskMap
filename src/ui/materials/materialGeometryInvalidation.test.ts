import { describe, expect, it, vi } from "vitest";
import {
  refreshMaterialSurfaceBackdrop,
  subscribeMaterialSurfaceGeometryInvalidation,
} from "./materialGeometryInvalidation";

describe("local material invalidation", () => {
  it("refreshes only target sampling bounds without perturbing material or transform styles", () => {
    const surface = document.createElement("div");
    const unrelated = document.createElement("div");
    const refresh = vi.fn();
    const unrelatedRefresh = vi.fn();
    subscribeMaterialSurfaceGeometryInvalidation(surface, refresh);
    subscribeMaterialSurfaceGeometryInvalidation(unrelated, unrelatedRefresh);

    refreshMaterialSurfaceBackdrop(surface);
    expect(surface.style.cssText).toBe("");
    refreshMaterialSurfaceBackdrop(surface);

    expect(surface.style.cssText).toBe("");
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(unrelatedRefresh).not.toHaveBeenCalled();
  });
});
