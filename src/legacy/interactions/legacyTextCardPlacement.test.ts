// @vitest-environment node
import { describe, expect, it } from "vitest";
import { getVirtualRowRange, isVirtualRowInRange } from "../../canvasMath";
import { getLegacyTextCardPreviewRowOffset } from "./legacyTextCardPlacement";

describe("legacy text-card drop-gap virtualization", () => {
  it("checks virtual ranges with the inserted bundle row offset", () => {
    const range = getVirtualRowRange({
      rowCount: 34,
      rowHeight: 43,
      rowGap: 8,
      padding: 17,
      scrollOffset: 510,
      viewportHeight: 255,
      overscanRows: 1,
    });
    expect(range).toEqual({ startIndex: 8, endIndex: 16 });

    const offset = (visibleIndex: number, insertionIndex: number, insertionCount: number) =>
      getLegacyTextCardPreviewRowOffset({
        targetContainerId: "container",
        containerId: "container",
        insertionIndex,
        visibleIndex,
        insertionCount,
      });

    expect(offset(9, 10, 2)).toBe(0);
    expect(isVirtualRowInRange(9, range, offset(9, 10, 2))).toBe(true);

    expect(offset(13, 10, 2)).toBe(2);
    expect(isVirtualRowInRange(13, range, offset(13, 10, 2))).toBe(true);
    expect(isVirtualRowInRange(14, range)).toBe(true);
    expect(isVirtualRowInRange(14, range, offset(14, 10, 2))).toBe(false);

    expect(isVirtualRowInRange(7, range)).toBe(false);
    expect(isVirtualRowInRange(7, range, offset(7, 7, 2))).toBe(true);
    expect(isVirtualRowInRange(16, range)).toBe(false);

    expect(offset(13, 10, 3)).toBe(3);
    expect(isVirtualRowInRange(13, range, offset(13, 10, 3))).toBe(false);
    expect(
      getLegacyTextCardPreviewRowOffset({
        targetContainerId: "other",
        containerId: "container",
        insertionIndex: 10,
        visibleIndex: 14,
        insertionCount: 2,
      }),
    ).toBe(0);
  });
});
