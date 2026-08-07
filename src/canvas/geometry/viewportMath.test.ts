// @vitest-environment node
import { describe, expect, it } from "vitest";
import { MAX_ZOOM, MIN_ZOOM } from "../../constants";
import {
  createViewport,
  resetViewportZoom,
  screenRectangleToWorld,
  screenToWorld,
  translateViewport,
  viewportWorldRectangle,
  wheelZoomViewport,
  worldToScreen,
  zoomViewportAt,
} from "./viewportMath";

const viewport = createViewport({ x: 120, y: -80 }, 1.5, { width: 900, height: 600 });

describe("viewport math", () => {
  it("round-trips screen and world coordinates", () => {
    const screen = { x: 345, y: 220 };
    expect(worldToScreen(screenToWorld(screen, viewport), viewport)).toEqual(screen);
  });

  it("translates pan in screen pixels", () => {
    expect(translateViewport(viewport, { x: 30, y: -15 }).pan).toEqual({ x: 150, y: -95 });
  });

  it("preserves the cursor world point while zooming", () => {
    const anchor = { x: 410, y: 255 };
    const world = screenToWorld(anchor, viewport);
    const zoomed = zoomViewportAt(viewport, anchor, 2.1);
    expect(worldToScreen(world, zoomed)).toEqual(anchor);
  });

  it("preserves wheel direction, magnitude cap, quantization, and bounds", () => {
    expect(
      wheelZoomViewport(createViewport({ x: 0, y: 0 }, 1, viewport.screen), { x: 0, y: 0 }, -100)
        .zoom,
    ).toBe(1.05);
    expect(
      wheelZoomViewport(createViewport({ x: 0, y: 0 }, 1, viewport.screen), { x: 0, y: 0 }, 10_000)
        .zoom,
    ).toBe(0.8);
    expect(zoomViewportAt(viewport, { x: 0, y: 0 }, 0).zoom).toBe(MIN_ZOOM);
    expect(zoomViewportAt(viewport, { x: 0, y: 0 }, 99).zoom).toBe(MAX_ZOOM);
  });

  it("derives world and converted rectangles", () => {
    expect(viewportWorldRectangle(viewport)).toEqual({
      x: -80,
      y: 160 / 3,
      width: 600,
      height: 400,
    });
    expect(screenRectangleToWorld({ x: 150, y: 70, width: 300, height: 150 }, viewport)).toEqual({
      x: 20,
      y: 100,
      width: 200,
      height: 100,
    });
  });

  it("resets around the screen center and rejects non-finite corruption", () => {
    const center = { x: viewport.screen.width / 2, y: viewport.screen.height / 2 };
    const world = screenToWorld(center, viewport);
    const reset = resetViewportZoom(viewport);
    expect(reset.zoom).toBe(1);
    expect(worldToScreen(world, reset)).toEqual(center);
    expect(
      createViewport({ x: Number.NaN, y: Infinity }, Number.NaN, { width: Infinity, height: -1 }),
    ).toEqual({
      pan: { x: 0, y: 0 },
      zoom: 1,
      screen: { width: 0, height: 0 },
    });
  });
});
