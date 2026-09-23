import { describe, expect, it } from "vitest";
import { glassListShape, writeGlassListEffectsClip } from "./glassListGeometry";

describe("shared scrollable glass-list geometry", () => {
  it("intersects a full rounded card with outer and nested viewports without re-rounding the slice", () => {
    const card = { x: 12, y: -80, width: 264, height: 84, radius: 13.5 };
    expect(
      glassListShape(
        card,
        { left: 0, top: 0, width: 288, height: 200 },
        { left: 20, top: 2, width: 240, height: 100 },
      ),
    ).toEqual({
      ...card,
      clip: { left: 20, top: 2, width: 240, height: 2 },
    });
    expect(card.height).toBe(84);
    expect(glassListShape(card, { left: 0, top: 5, width: 288, height: 200 })).toBeNull();
  });

  it("lets a fully visible card's external shadow extend beyond its content box", () => {
    const host = document.createElement("div");
    writeGlassListEffectsClip(host, 94, 84, 300);
    expect(host.style.getPropertyValue("--taskmap-glass-list-clip-top")).toBe("-94px");
    expect(host.style.getPropertyValue("--taskmap-glass-list-clip-bottom")).toBe("-122px");
    writeGlassListEffectsClip(host, -40, 84, 300);
    expect(host.style.getPropertyValue("--taskmap-glass-list-clip-top")).toBe("40px");
  });
});
