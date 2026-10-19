import { describe, expect, it, vi } from "vitest";
import {
  readMaterialPresentation,
  subscribeMaterialPresentation,
  writeMaterialReveal,
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

describe("material reveal", () => {
  it("clips the surface to its revealed top and tells shared planes the visible height", () => {
    const surface = document.createElement("div");
    const refreshPlane = vi.fn();
    subscribeMaterialPresentation(surface, refreshPlane);

    writeMaterialReveal(surface, 120, 348);
    expect(surface.style.clipPath).toBe("inset(0 0 228px 0 round var(--taskmap-material-radius))");
    expect(readMaterialPresentation(surface).visibleHeight).toBe(120);
    expect(refreshPlane).toHaveBeenCalledOnce();

    writeMaterialReveal(surface, 40, 40);
    expect(surface.style.clipPath).toBe("");
    expect(readMaterialPresentation(surface).visibleHeight).toBe(40);
  });

  it("can also hide a surface from the left, keeping its right edge", () => {
    const surface = document.createElement("div");
    writeMaterialReveal(surface, 200, 460, { visible: 120, full: 300 });
    expect(surface.style.clipPath).toBe(
      "inset(0 0 260px 180px round var(--taskmap-material-radius))",
    );
    expect(readMaterialPresentation(surface)).toMatchObject({
      visibleHeight: 200,
      visibleWidth: 120,
    });
  });
});
