import { describe, expect, it } from "vitest";
import {
  clearMaterialPresenceProgress,
  MATERIAL_PRESENCE_PROGRESS_PROPERTY,
  writeMaterialPresenceProgress,
} from "./materialPresence";

describe("material presence seam", () => {
  it("writes one clamped inherited progress value without changing root presentation", () => {
    const surface = document.createElement("div");

    writeMaterialPresenceProgress(surface, 0.999);
    expect(surface.style.getPropertyValue(MATERIAL_PRESENCE_PROGRESS_PROPERTY)).toBe("0.999");
    expect(surface.style.opacity).toBe("");
    expect(surface.style.filter).toBe("");
    expect(surface.style.transform).toBe("");

    writeMaterialPresenceProgress(surface, -1);
    expect(surface.style.getPropertyValue(MATERIAL_PRESENCE_PROGRESS_PROPERTY)).toBe("0");
    writeMaterialPresenceProgress(surface, 2);
    expect(surface.style.getPropertyValue(MATERIAL_PRESENCE_PROGRESS_PROPERTY)).toBe("1");

    clearMaterialPresenceProgress(surface);
    expect(surface.style.getPropertyValue(MATERIAL_PRESENCE_PROGRESS_PROPERTY)).toBe("");
  });
});
