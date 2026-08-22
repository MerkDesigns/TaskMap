// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createViewport } from "../geometry/viewportMath";
import {
  CANVAS_CULLING_REFRESH_SCREEN_PX,
  CANVAS_RENDER_OVERSCAN_SCREEN_PX,
  getVisibleElementIds,
  overscannedWorldRectangle,
  shouldRefreshCullingViewport,
} from "./viewportCulling";

describe("viewport culling", () => {
  it("converts the 480 screen-pixel overscan through zoom", () => {
    const viewport = createViewport({ x: 0, y: 0 }, 2, { width: 1000, height: 600 });
    expect(overscannedWorldRectangle(viewport)).toEqual({
      x: -240,
      y: -240,
      width: 980,
      height: 780,
    });
    expect(CANVAS_RENDER_OVERSCAN_SCREEN_PX).toBe(480);
  });

  it("keeps intersecting and pinned elements while bounding a large fixture", () => {
    const elements = Array.from({ length: 10_000 }, (_, index) => ({
      id: `element-${index}`,
      geometry: {
        x: (index % 100) * 500,
        y: Math.floor(index / 100) * 500,
        width: 100,
        height: 100,
      },
    }));
    const visible = getVisibleElementIds({
      viewport: createViewport({ x: -25_000, y: -25_000 }, 1, {
        width: 1200,
        height: 800,
      }),
      elements,
      pinnedIds: new Set(["element-0", "element-9999"]),
    });
    expect(visible.has("element-0")).toBe(true);
    expect(visible.has("element-9999")).toBe(true);
    expect(visible.size).toBeGreaterThan(2);
    expect(visible.size).toBeLessThan(40);
  });

  it("does not include an element outside visible bounds when overscan is disabled", () => {
    const visible = getVisibleElementIds({
      viewport: createViewport({ x: 0, y: 0 }, 1, { width: 100, height: 100 }),
      elements: [
        { id: "inside", geometry: { x: 90, y: 90, width: 20, height: 20 } },
        { id: "outside", geometry: { x: 101, y: 0, width: 20, height: 20 } },
      ],
      overscanScreen: 0,
    });
    expect([...visible]).toEqual(["inside"]);
  });

  it("reuses the overscanned culling viewport during short pan frames", () => {
    const previous = createViewport({ x: 0, y: 0 }, 1, { width: 1000, height: 600 });
    const withinGuard = createViewport(
      { x: CANVAS_CULLING_REFRESH_SCREEN_PX - 1, y: -120 },
      1,
      previous.screen,
    );
    const acrossGuard = createViewport(
      { x: CANVAS_CULLING_REFRESH_SCREEN_PX, y: -120 },
      1,
      previous.screen,
    );

    expect(shouldRefreshCullingViewport(previous, withinGuard, true)).toBe(false);
    expect(shouldRefreshCullingViewport(previous, acrossGuard, true)).toBe(true);
    expect(shouldRefreshCullingViewport(previous, withinGuard, false)).toBe(true);
    expect(
      shouldRefreshCullingViewport(
        previous,
        createViewport(previous.pan, 1.25, previous.screen),
        true,
      ),
    ).toBe(true);
  });
});
