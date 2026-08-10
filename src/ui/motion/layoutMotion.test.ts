import { describe, expect, it } from "vitest";
import { calculateFlipTransform } from "./layoutMotion";

describe("layout motion", () => {
  it("calculates local FLIP position and resize inversion", () => {
    expect(
      calculateFlipTransform(
        { left: 10, top: 20, width: 100, height: 40 },
        { left: 50, top: 35, width: 200, height: 20 },
      ),
    ).toEqual({ translateX: -40, translateY: -15, scaleX: 0.5, scaleY: 2 });
  });

  it("avoids invalid scaling for collapsed target geometry", () => {
    expect(
      calculateFlipTransform(
        { left: 0, top: 0, width: 10, height: 10 },
        { left: 0, top: 0, width: 0, height: 0 },
      ),
    ).toMatchObject({ scaleX: 1, scaleY: 1 });
  });
});
