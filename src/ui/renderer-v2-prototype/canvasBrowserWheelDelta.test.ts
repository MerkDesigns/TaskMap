// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  convertCanvasBrowserWheelDelta,
  NORMAL_WHEEL_DELTA_SCALE,
} from "./canvasBrowserWheelDelta";

describe("Canvas Browser wheel delta", () => {
  it("scales normal pixel, line, and page wheel input by exactly 0.45", () => {
    expect(NORMAL_WHEEL_DELTA_SCALE).toBe(0.45);
    expect(convertCanvasBrowserWheelDelta(100, 0, 500)).toBeCloseTo(45);
    expect(convertCanvasBrowserWheelDelta(3, 1, 500)).toBeCloseTo(21.6);
    expect(convertCanvasBrowserWheelDelta(1, 2, 500)).toBeCloseTo(225);
  });
});
