import { afterEach, describe, expect, it, vi } from "vitest";
import { MaterialGeometryFrame } from "../../materials/materialGeometryScheduler";
import {
  glassListSliceInsets,
  glassListSlicedSize,
  projectGlassListScroll,
  projectGlassListSlices,
  readGlassListLayout,
} from "./glassListScrollGeometry";

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("native glass-list scroll projection", () => {
  it("shares nested viewport reads and translates cached full cards without layout reads", () => {
    const owner = document.createElement("div");
    const viewport = document.createElement("div");
    const nested = document.createElement("div");
    nested.dataset.sharedSmallGlassViewport = "true";
    const plane = document.createElement("div");
    owner.append(plane, viewport);
    viewport.append(nested);
    document.body.append(owner);
    const cards = Array.from({ length: 3 }, () => {
      const card = document.createElement("div");
      card.dataset.card = "true";
      card.style.cssText = "width:100px;height:58px;--taskmap-material-radius:8px";
      nested.append(card);
      return card;
    });
    const ownerRead = vi
      .spyOn(owner, "getBoundingClientRect")
      .mockReturnValue(new DOMRect(10, 10, 120, 200));
    const viewportRead = vi
      .spyOn(viewport, "getBoundingClientRect")
      .mockReturnValue(new DOMRect(10, 10, 120, 200));
    const nestedRead = vi
      .spyOn(nested, "getBoundingClientRect")
      .mockReturnValue(new DOMRect(10, 60, 120, 140));
    const cardReads = cards.map((card, i) =>
      vi
        .spyOn(card, "getBoundingClientRect")
        .mockReturnValue(new DOMRect(20, 60 + i * 66, 100, 58)),
    );
    const layout = readGlassListLayout(new MaterialGeometryFrame(), viewport, plane, "[data-card]");
    expect(nestedRead).toHaveBeenCalledOnce();
    [ownerRead, viewportRead, nestedRead, ...cardReads].forEach((read) => read.mockClear());
    nested.scrollTop = 56;
    viewport.scrollTop = 5;
    const projected = projectGlassListScroll(layout);
    expect(projected[0]).toMatchObject({
      x: 10,
      y: -11,
      height: 58,
      radius: 8,
      clip: { left: 10, top: 45, width: 100, height: 2 },
    });
    // Scroll-edge morph slice: only the 2px visible strip remains of the first card.
    const [edge] = projectGlassListSlices(layout);
    expect(edge.element).toBe(cards[0]);
    expect(glassListSliceInsets(edge)).toEqual([56, 0, 0, 0]);
    expect(glassListSlicedSize(edge)).toEqual({ width: 100, height: 2 });
    [ownerRead, viewportRead, nestedRead, ...cardReads].forEach((read) =>
      expect(read).not.toHaveBeenCalled(),
    );
  });

  it("reports no slice for cards scrolled fully out of view", () => {
    const element = document.createElement("div");
    expect(glassListSliceInsets({ element, size: { width: 10, height: 10 }, shape: null })).toBe(
      null,
    );
    expect(glassListSlicedSize({ element, size: { width: 10, height: 10 }, shape: null })).toEqual({
      width: 10,
      height: 10,
    });
  });

  it("clips to the viewport content box so padding stays an effects gutter", () => {
    const owner = document.createElement("div");
    const plane = document.createElement("div");
    const viewport = document.createElement("div");
    viewport.style.cssText = "padding: 0 12px 12px";
    const card = document.createElement("div");
    card.dataset.card = "true";
    card.style.cssText = "width:276px;height:40px;--taskmap-material-radius:8px";
    owner.append(plane, viewport);
    viewport.append(card);
    document.body.append(owner);
    vi.spyOn(owner, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 300, 200));
    vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 300, 200));
    vi.spyOn(card, "getBoundingClientRect").mockReturnValue(new DOMRect(12, 160, 276, 40));
    const [slice] = projectGlassListSlices(
      readGlassListLayout(new MaterialGeometryFrame(), viewport, plane, "[data-card]"),
    );
    // Visible area ends at 188 (200 minus the 12px bottom gutter): 28px of the card remain.
    expect(slice.shape?.clip).toEqual({ left: 12, top: 160, width: 276, height: 28 });
    expect(glassListSliceInsets(slice)).toEqual([0, 0, 12, 0]);
  });

  it("measures in local coordinates while an ancestor is mid scale-in", () => {
    const owner = document.createElement("div");
    owner.style.cssText = "width:300px;height:200px";
    const plane = document.createElement("div");
    const viewport = document.createElement("div");
    const card = document.createElement("div");
    card.dataset.card = "true";
    card.style.cssText = "width:276px;height:40px;--taskmap-material-radius:8px";
    owner.append(plane, viewport);
    viewport.append(card);
    document.body.append(owner);
    // Owner rendered at 96% scale around its centre (layout 300x200 -> 288x192 on screen).
    vi.spyOn(owner, "getBoundingClientRect").mockReturnValue(new DOMRect(106, 54, 288, 192));
    vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue(new DOMRect(106, 54, 288, 192));
    vi.spyOn(card, "getBoundingClientRect").mockReturnValue(
      new DOMRect(106 + 12 * 0.96, 54 + 20 * 0.96, 276 * 0.96, 40 * 0.96),
    );
    const [slice] = projectGlassListSlices(
      readGlassListLayout(new MaterialGeometryFrame(), viewport, plane, "[data-card]"),
    );
    const shape = slice.shape!;
    expect(shape.x).toBeCloseTo(12);
    expect(shape.y).toBeCloseTo(20);
    expect(shape.width).toBeCloseTo(276);
    expect(shape.height).toBeCloseTo(40);
  });
});
