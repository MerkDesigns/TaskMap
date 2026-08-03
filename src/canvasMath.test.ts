import { describe, expect, it } from "vitest";

import { MAX_ZOOM, MIN_ZOOM } from "./constants";
import {
  clamp,
  findSnapOffset,
  getVirtualRowRange,
  getWheelZoom,
  isVirtualRowInRange,
  quantizeZoom,
} from "./canvasMath";

describe("canvas math", () => {
  it("clamps values to a range", () => {
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(4, 0, 10)).toBe(4);
    expect(clamp(12, 0, 10)).toBe(10);
  });

  it("quantizes zoom to five-percent increments and clamps the result", () => {
    expect(quantizeZoom(1.02)).toBe(1);
    expect(quantizeZoom(1.03)).toBeCloseTo(1.05);
    expect(quantizeZoom(0)).toBe(MIN_ZOOM);
    expect(quantizeZoom(10)).toBe(MAX_ZOOM);
  });

  it("zooms in and out in the wheel direction", () => {
    expect(getWheelZoom(1, -100)).toBeCloseTo(1.05);
    expect(getWheelZoom(1, 100)).toBeCloseTo(0.95);
    expect(getWheelZoom(1.02, 0)).toBe(1);
    expect(getWheelZoom(2, -100)).toBeCloseTo(2.1);
    expect(getWheelZoom(2, 100)).toBeCloseTo(1.9);
  });

  it("caps a single wheel event at four steps", () => {
    expect(getWheelZoom(1, -10_000)).toBeCloseTo(1.2);
    expect(getWheelZoom(1, 10_000)).toBeCloseTo(0.8);
  });

  it("returns every element edge aligned by the selected snap offset", () => {
    expect(
      findSnapOffset(
        [
          { value: 102, kind: "start" },
          { value: 143, kind: "end" },
        ],
        [
          { value: 100, kind: "start" },
          { value: 141, kind: "end" },
        ],
      ),
    ).toEqual({
      offset: -2,
      guide: 100,
      guides: [100, 141],
    });
  });

  it("aligns center guides independently of differently sized edges", () => {
    expect(
      findSnapOffset(
        [{ value: 202, kind: "center" }],
        [
          { value: 150, kind: "start" },
          { value: 200, kind: "center" },
          { value: 250, kind: "end" },
        ],
      ),
    ).toEqual({ offset: -2, guide: 200, guides: [200] });
  });

  it("never crosses the fifty-percent minimum and recovers invalid legacy zoom", () => {
    expect(getWheelZoom(0.5, 100)).toBe(MIN_ZOOM);
    expect(getWheelZoom(0.55, 10_000)).toBe(MIN_ZOOM);
    expect(getWheelZoom(0.45, -100)).toBe(MIN_ZOOM);
    expect(getWheelZoom(0.5, -100)).toBeCloseTo(0.55);
  });

  it("returns only visible fixed rows plus overscan", () => {
    expect(
      getVirtualRowRange({
        rowCount: 100,
        rowHeight: 43,
        rowGap: 8,
        padding: 17,
        scrollOffset: 0,
        viewportHeight: 250,
        overscanRows: 2,
      }),
    ).toEqual({ startIndex: 0, endIndex: 7 });

    expect(
      getVirtualRowRange({
        rowCount: 100,
        rowHeight: 43,
        rowGap: 8,
        padding: 17,
        scrollOffset: 510,
        viewportHeight: 200,
        overscanRows: 2,
      }),
    ).toEqual({ startIndex: 7, endIndex: 16 });
  });

  it("handles row boundaries, list ends, and empty viewports", () => {
    const options = {
      rowCount: 100,
      rowHeight: 43,
      rowGap: 8,
      padding: 17,
    };

    expect(
      getVirtualRowRange({
        ...options,
        scrollOffset: 60,
        viewportHeight: 10,
      }),
    ).toEqual({ startIndex: 1, endIndex: 2 });
    expect(
      getVirtualRowRange({
        ...options,
        scrollOffset: 4_926,
        viewportHeight: 200,
        overscanRows: 2,
      }),
    ).toEqual({ startIndex: 94, endIndex: 100 });
    expect(
      getVirtualRowRange({
        ...options,
        scrollOffset: 0,
        viewportHeight: 0,
      }),
    ).toEqual({ startIndex: 0, endIndex: 0 });
  });

  it("applies drag-preview row shifts before checking the render range", () => {
    const range = { startIndex: 7, endIndex: 16 };

    expect(isVirtualRowInRange(7, range)).toBe(true);
    expect(isVirtualRowInRange(5, range, 2)).toBe(true);
    expect(isVirtualRowInRange(4, range, 2)).toBe(false);
    expect(isVirtualRowInRange(14, range, 2)).toBe(false);
  });

  it("keeps the final row renderable when a drop preview shifts it down", () => {
    const range = getVirtualRowRange({
      rowCount: 4,
      rowHeight: 43,
      rowGap: 8,
      padding: 17,
      scrollOffset: 0,
      viewportHeight: 250,
    });

    expect(isVirtualRowInRange(2, range, 1)).toBe(true);
  });
});
