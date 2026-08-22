import { describe, expect, it, vi } from "vitest";
import {
  refreshMaterialSurfaceBackdrop,
  subscribeMaterialSurfaceGeometryInvalidation,
} from "./materialGeometryInvalidation";

describe("local material invalidation", () => {
  it("changes the compositor revision while refreshing only the target surface", () => {
    const surface = document.createElement("div");
    const unrelated = document.createElement("div");
    const refresh = vi.fn();
    const unrelatedRefresh = vi.fn();
    subscribeMaterialSurfaceGeometryInvalidation(surface, refresh);
    subscribeMaterialSurfaceGeometryInvalidation(unrelated, unrelatedRefresh);

    refreshMaterialSurfaceBackdrop(surface);
    expect(surface.style.getPropertyValue("--taskmap-material-backdrop-revision")).toBe("0.01px");
    refreshMaterialSurfaceBackdrop(surface);

    expect(surface.style.getPropertyValue("--taskmap-material-backdrop-revision")).toBe("0px");
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(unrelatedRefresh).not.toHaveBeenCalled();
  });
});
