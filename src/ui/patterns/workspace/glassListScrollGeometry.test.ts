import { afterEach, describe, expect, it, vi } from "vitest";
import { MaterialGeometryFrame } from "../../materials/materialGeometryScheduler";
import { projectGlassListScroll, readGlassListLayout } from "./glassListScrollGeometry";

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
    [ownerRead, viewportRead, nestedRead, ...cardReads].forEach((read) =>
      expect(read).not.toHaveBeenCalled(),
    );
  });
});
