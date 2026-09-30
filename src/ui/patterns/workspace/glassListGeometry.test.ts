import { describe, expect, it } from "vitest";
import { glassListShape } from "./glassListGeometry";

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
});
