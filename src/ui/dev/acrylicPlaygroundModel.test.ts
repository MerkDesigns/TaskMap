import { describe, expect, it } from "vitest";
import {
  ACRYLIC_PLAYGROUND_SCENE,
  ACRYLIC_PLAYGROUND_SURFACE_PRESETS,
  createAcrylicPlaygroundPresentation,
  findAcrylicPlaygroundSurfacePreset,
  panAcrylicPlaygroundView,
  resetAcrylicPlaygroundView,
  zoomAcrylicPlaygroundView,
} from "./acrylicPlaygroundModel";

const hostBounds = { x: 100, y: 80, width: 680, height: 360 };
const windowSize = { width: 1280, height: 800 };

describe("acrylic compositor playground model", () => {
  it("uses the same frozen scene for visible and compositor projection", () => {
    const view = resetAcrylicPlaygroundView(hostBounds);
    const presentation = createAcrylicPlaygroundPresentation({
      scene: ACRYLIC_PLAYGROUND_SCENE,
      view,
      hostBounds,
      windowSize,
      interactionActive: false,
    });
    expect(Object.isFrozen(ACRYLIC_PLAYGROUND_SCENE)).toBe(true);
    expect(presentation.buildScene(hostBounds, view.zoom)).toBe(ACRYLIC_PLAYGROUND_SCENE);
    expect(presentation.sceneKey).toBe(ACRYLIC_PLAYGROUND_SCENE.identity.key);
  });

  it("projects local pan into the synthetic global viewport", () => {
    const initial = resetAcrylicPlaygroundView(hostBounds);
    const moved = panAcrylicPlaygroundView(initial, { x: 45, y: -20 });
    const presentation = createAcrylicPlaygroundPresentation({
      scene: ACRYLIC_PLAYGROUND_SCENE,
      view: moved,
      hostBounds,
      windowSize,
      interactionActive: true,
    });
    expect(moved.pan).toEqual({ x: initial.pan.x + 45, y: initial.pan.y - 20 });
    expect(presentation.viewport.pan).toEqual({
      x: hostBounds.x + moved.pan.x,
      y: hostBounds.y + moved.pan.y,
    });
    expect(presentation.interactionActive).toBe(true);
  });

  it("zooms around the local cursor anchor", () => {
    const initial = resetAcrylicPlaygroundView(hostBounds);
    const anchor = { x: 220, y: 140 };
    const worldBefore = {
      x: (anchor.x - initial.pan.x) / initial.zoom,
      y: (anchor.y - initial.pan.y) / initial.zoom,
    };
    const zoomed = zoomAcrylicPlaygroundView(initial, anchor, -120);
    expect(zoomed.zoom).toBeGreaterThan(initial.zoom);
    expect((anchor.x - zoomed.pan.x) / zoomed.zoom).toBeCloseTo(worldBefore.x, 8);
    expect((anchor.y - zoomed.pan.y) / zoomed.zoom).toBeCloseTo(worldBefore.y, 8);
  });

  it("reset restores the deterministic fixture viewport", () => {
    const expected = resetAcrylicPlaygroundView(hostBounds);
    const moved = panAcrylicPlaygroundView(expected, { x: 90, y: 50 });
    expect(resetAcrylicPlaygroundView(hostBounds)).toEqual(expected);
    expect(moved).not.toEqual(expected);
  });

  it("maps every surface preset to an existing material ID and explicit geometry", () => {
    expect(ACRYLIC_PLAYGROUND_SURFACE_PRESETS.map((item) => item.material)).toEqual([
      "acrylic-large",
      "acrylic-small",
      "acrylic-small",
      "acrylic-small",
      "cutout",
    ]);
    expect(findAcrylicPlaygroundSurfacePreset("liquid-selection")).toMatchObject({
      material: "acrylic-small",
      radius: 7,
    });
    expect(findAcrylicPlaygroundSurfacePreset("cutout").note).toContain("does not blur");
  });

  it("contains both grids and high-contrast thin/bordered geometry", () => {
    const primitives = ACRYLIC_PLAYGROUND_SCENE.primitives;
    expect(ACRYLIC_PLAYGROUND_SCENE.grid?.kind).toBe("dots");
    expect(primitives.some((item) => item.bounds.width === 1 || item.bounds.height === 1)).toBe(
      true,
    );
    expect(primitives.some((item) => item.stroke?.widthWorld === 2)).toBe(true);
    expect(primitives.some((item) => item.fill === "#e36b55")).toBe(true);
    expect(primitives.some((item) => item.fill === "#137b78")).toBe(true);
    expect(primitives.some((item) => item.fill === "#e7edf2")).toBe(true);
  });
});
