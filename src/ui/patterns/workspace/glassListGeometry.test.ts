import { describe, expect, it } from "vitest";
import { glassListMorphInset, glassListShape, narrowGlassListMorph } from "./glassListGeometry";

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

  it("narrows a slice too thin for full corners so its straight edge starts where the corners end", () => {
    expect(glassListMorphInset(40, 13.5)).toBe(0);
    expect(glassListMorphInset(27, 13.5)).toBe(0);
    expect(glassListMorphInset(6, 13.5)).toBe(10.5);
    expect(glassListMorphInset(0, 13.5)).toBe(0);
    const card = { x: 12, y: -80, width: 264, height: 84, radius: 13.5 };
    const shape = glassListShape(card, { left: 0, top: 0, width: 288, height: 200 })!;
    expect(narrowGlassListMorph(shape).clip).toEqual({ left: 23.5, top: 0, width: 241, height: 4 });
    const tall = glassListShape(card, { left: 0, top: -60, width: 288, height: 200 })!;
    expect(narrowGlassListMorph(tall)).toBe(tall);
  });
});
