import { afterEach, describe, expect, it, vi } from "vitest";
import { CANVAS_CARD_SLOT_TRANSITION_MS, easeOutQuart } from "./canvasBrowserInteraction";
import { CANVAS_BROWSER_LAYOUT } from "./canvasBrowserLayout";
import { dispatchPointer, runtimeFixture, wheel } from "./canvasBrowserRuntimeTestFixture";
import { readSuppliedMaterialSurfaceSize } from "../../materials/materialGeometryInvalidation";

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("production Canvas Browser runtime", () => {
  it("settles reduced-motion cancellation with the same card and material ancestry", () => {
    const fixture = runtimeFixture(["a", "b", "c"]);
    fixture.runtime.setReducedMotion(true);
    const { host, card } = fixture.cards.get("a")!;
    fixture.begin("a", 100);
    dispatchPointer("pointermove", 300);
    fixture.frames.fire(16);
    expect(host.parentElement).toBe(fixture.cardsLayer);
    dispatchPointer("pointercancel", 300);
    fixture.frames.fire(32);
    fixture.frames.fire(48);
    expect(fixture.runtime.getSnapshot()).toMatchObject({
      dragActive: false,
      order: ["a", "b", "c"],
    });
    expect(host.parentElement).toBe(fixture.cardsLayer);
    expect(host.firstElementChild).toBe(card);
    expect(fixture.commitOrder).not.toHaveBeenCalled();
    fixture.destroy();
  });

  it("does not measure cards while reconciling or scrolling and reads drag spaces once per frame", () => {
    const fixture = runtimeFixture(["a", "b", "c", "d", "e"], 180);
    const cards = [...fixture.cards.values()].map(({ card }) =>
      vi.spyOn(card, "getBoundingClientRect"),
    );
    const viewport = vi.spyOn(fixture.viewport, "getBoundingClientRect");
    const panel = vi.spyOn(fixture.panel, "getBoundingClientRect");
    fixture.runtime.reconcile(["a", "b", "c", "d", "e"]);
    fixture.runtime.scrollByWheel(100, 0);
    fixture.frames.flush(30);
    cards.forEach((measure) => expect(measure).not.toHaveBeenCalled());
    expect(viewport).not.toHaveBeenCalled();
    fixture.begin("b", 140);
    dispatchPointer("pointermove", 260);
    fixture.frames.fire(600);
    expect(viewport).toHaveBeenCalledOnce();
    expect(panel).not.toHaveBeenCalled();
    viewport.mockClear();
    panel.mockClear();
    cards.forEach((measure) => measure.mockClear());
    dispatchPointer("pointermove", 280);
    fixture.frames.fire(616);
    expect(viewport).toHaveBeenCalledOnce();
    expect(panel).not.toHaveBeenCalled();
    cards.forEach((measure) => expect(measure).not.toHaveBeenCalled());
    dispatchPointer("pointercancel", 280);
    fixture.frames.fire(632);
    viewport.mockClear();
    panel.mockClear();
    fixture.frames.fire(700);
    expect(viewport).toHaveBeenCalledOnce();
    expect(panel).not.toHaveBeenCalled();
    fixture.destroy();
  });

  it("uses the finalized Renderer V2 layout and presentation constants", () => {
    expect(CANVAS_BROWSER_LAYOUT).toMatchObject({
      x: 16,
      y: 64,
      width: 288,
      headerHeight: 58,
      cardInset: 12,
      cardWidth: 264,
      cardHeight: 84,
      cardGap: 10,
      largeRadius: 23,
      previewInset: 9,
      previewAspectRatio: 1.7333333333333334,
      previewHeight: 66,
      previewWidth: 114.4,
      previewRadius: 8,
      titleFontSize: 14,
      subtitleFontSize: 11,
      optionsRightGap: 11,
      selectedMarkerHeight: 22,
    });
  });

  it("owns wheel input from the viewport and nested card content without routing to the canvas", () => {
    const fixture = runtimeFixture(["a", "b", "c", "d", "e"], 180);
    const canvasWheel = vi.fn();
    document.addEventListener("wheel", canvasWheel);
    const nestedTitle = document.createElement("strong");
    fixture.cards.get("a")!.card.append(nestedTitle);

    const viewportWheel = wheel(100);
    fixture.viewport.dispatchEvent(viewportWheel);
    expect(viewportWheel.defaultPrevented).toBe(true);
    expect(fixture.runtime.getSnapshot().scroll.targetScrollY).toBe(45);

    const nestedWheel = wheel(100);
    nestedTitle.dispatchEvent(nestedWheel);
    expect(nestedWheel.defaultPrevented).toBe(true);
    expect(fixture.runtime.getSnapshot().scroll.targetScrollY).toBe(90);
    expect(canvasWheel).not.toHaveBeenCalled();

    fixture.frames.flush(100);
    expect(fixture.runtime.getSnapshot().scroll.currentScrollY).toBeCloseTo(90);
    document.removeEventListener("wheel", canvasWheel);
    fixture.destroy();
  });

  it("publishes a local panel-size change when the card count changes", () => {
    const fixture = runtimeFixture(["a", "b", "c"]);
    const changed = vi.fn();
    fixture.panel.addEventListener("taskmap:workspace-panel-content-size", changed);

    fixture.runtime.reconcile(["a", "b"]);

    expect(fixture.panel.style.getPropertyValue("--taskmap-canvas-browser-content-height")).toBe(
      "248px",
    );
    expect(changed).toHaveBeenCalledTimes(1);
    expect((changed.mock.calls[0][0] as CustomEvent<number>).detail).toBe(248);
    fixture.destroy();
  });

  it("updates viewport intersections without shortening material or content geometry", () => {
    const fixture = runtimeFixture(["a", "b", "c"], 100);
    const firstHost = fixture.cards.get("a")!.host;
    const secondHost = fixture.cards.get("b")!.host;

    expect(firstHost.style.getPropertyValue("--taskmap-canvas-card-visible-height")).toBe("84px");
    expect(secondHost.style.getPropertyValue("--taskmap-canvas-card-visible-height")).toBe("6px");
    expect(secondHost.style.getPropertyValue("--taskmap-canvas-card-clip-offset")).toBe("0px");
    expect(readSuppliedMaterialSurfaceSize(fixture.cards.get("b")!.card)).toEqual({
      width: 264,
      height: 84,
    });

    fixture.viewport.dispatchEvent(wheel(100));
    fixture.frames.fire(16);
    const firstOffset = Number.parseFloat(
      firstHost.style.getPropertyValue("--taskmap-canvas-card-clip-offset"),
    );
    const firstHeight = Number.parseFloat(
      firstHost.style.getPropertyValue("--taskmap-canvas-card-visible-height"),
    );
    expect(firstOffset).toBeGreaterThan(0);
    expect(firstHeight).toBeCloseTo(84 - firstOffset);
    expect(firstHost.style.getPropertyValue("--taskmap-canvas-card-full-height")).toBe("84px");

    fixture.frames.fire(32);
    expect(readSuppliedMaterialSurfaceSize(fixture.cards.get("a")!.card)).toEqual({
      width: 264,
      height: 84,
    });
    expect(
      Number.parseFloat(firstHost.style.getPropertyValue("--taskmap-canvas-card-clip-offset")),
    ).toBeGreaterThan(firstOffset);
    fixture.destroy();
  });

  it("restores the viewport clip without moving the full-size card to another parent", () => {
    const fixture = runtimeFixture(["a", "b", "c"], 100);
    const secondHost = fixture.cards.get("b")!.host;
    expect(secondHost.style.getPropertyValue("--taskmap-canvas-card-visible-height")).toBe("6px");

    fixture.begin("b", 171);
    dispatchPointer("pointermove", 177);
    fixture.frames.fire(16);
    expect(secondHost.parentElement).toBe(fixture.cardsLayer);
    expect(secondHost.style.getPropertyValue("--taskmap-canvas-card-visible-height")).toBe("84px");

    dispatchPointer("pointercancel", 177);
    fixture.frames.fire(32);
    fixture.frames.fire(222);
    expect(secondHost.parentElement).toBe(fixture.cardsLayer);
    const expectedVisibleHeight = 6 + fixture.runtime.getSnapshot().scroll.currentScrollY;
    expect(
      Number.parseFloat(secondHost.style.getPropertyValue("--taskmap-canvas-card-visible-height")),
    ).toBeCloseTo(expectedVisibleHeight);
    expect(secondHost.style.getPropertyValue("--taskmap-canvas-card-full-height")).toBe("84px");
    fixture.destroy();
  });

  it("requires 6px, leaves clicks untouched below threshold, and never clones", () => {
    const fixture = runtimeFixture(["a", "b"]);
    const cloneNode = vi.spyOn(Node.prototype, "cloneNode");

    fixture.begin("a", 100);
    dispatchPointer("pointermove", 105);
    fixture.frames.fire(16);
    expect(fixture.runtime.getSnapshot()).toMatchObject({ dragActive: false, order: ["a", "b"] });
    dispatchPointer("pointerup", 105);
    fixture.frames.fire(32);

    expect(fixture.commitOrder).not.toHaveBeenCalled();
    expect(fixture.cards.get("a")?.host.parentElement).toBe(fixture.cardsLayer);
    expect(cloneNode).not.toHaveBeenCalled();
    fixture.destroy();
  });

  it("keeps the actual card in place, performs multi-slot reorder, and commits once after 190ms", () => {
    const fixture = runtimeFixture(["a", "b", "c", "d", "e"]);
    const record = fixture.cards.get("a")!;
    const originalCard = record.card;

    fixture.begin("a", 100);
    dispatchPointer("pointermove", 650);
    fixture.frames.fire(16);

    expect(record.card).toBe(originalCard);
    expect(record.host.parentElement).toBe(fixture.cardsLayer);
    expect(record.card).not.toHaveAttribute("data-material-motion");
    expect(
      fixture.sharedGlassPlane.querySelectorAll("[data-shared-small-glass-clip] > rect"),
    ).toHaveLength(4);
    expect(
      fixture.dragGlassPlane.querySelectorAll("[data-shared-small-glass-clip] > rect"),
    ).toHaveLength(1);
    expect(document.querySelector("[data-canvas-card-placeholder]")).toBeNull();
    expect(fixture.runtime.getSnapshot().order).toEqual(["b", "c", "d", "e", "a"]);
    expect(fixture.commitOrder).not.toHaveBeenCalled();

    dispatchPointer("pointerup", 650);
    fixture.frames.fire(32);
    const snapFrom = Number.parseFloat(
      record.host.style.getPropertyValue("--taskmap-canvas-card-y"),
    );
    const target = 4 * 94 - fixture.runtime.getSnapshot().scroll.currentScrollY;
    fixture.frames.fire(32 + CANVAS_CARD_SLOT_TRANSITION_MS / 2);
    const halfway = Number.parseFloat(
      record.host.style.getPropertyValue("--taskmap-canvas-card-y"),
    );
    expect(halfway).toBeCloseTo(snapFrom + (target - snapFrom) * easeOutQuart(0.5));
    expect(record.host.parentElement).toBe(fixture.cardsLayer);

    fixture.frames.fire(32 + CANVAS_CARD_SLOT_TRANSITION_MS);
    expect(record.card).toBe(originalCard);
    expect(record.host.parentElement).toBe(fixture.cardsLayer);
    expect(record.card).not.toHaveAttribute("data-material-motion");
    expect(
      fixture.sharedGlassPlane.querySelectorAll("[data-shared-small-glass-clip] > rect"),
    ).toHaveLength(5);
    expect(
      fixture.dragGlassPlane.querySelectorAll("[data-shared-small-glass-clip] > rect"),
    ).toHaveLength(0);
    expect(fixture.commitOrder).toHaveBeenCalledTimes(1);
    expect(fixture.commitOrder).toHaveBeenCalledWith(["b", "c", "d", "e", "a"]);
    fixture.destroy();
  });

  it("reorders in scrolled list space and auto-scrolls continuously near an outside edge", () => {
    const ids = Array.from({ length: 12 }, (_, index) => `canvas-${index}`);
    const fixture = runtimeFixture(ids, 300);
    fixture.runtime.scrollByWheel(400, 0);
    fixture.frames.flush(100);
    const before = fixture.runtime.getSnapshot().scroll.currentScrollY;

    fixture.begin("canvas-3", 250);
    dispatchPointer("pointermove", 500);
    fixture.frames.fire(1_616);
    fixture.frames.fire(1_632);

    expect(fixture.runtime.getSnapshot().scroll.currentScrollY).toBeGreaterThan(before);
    expect(fixture.runtime.getSnapshot().order.indexOf("canvas-3")).toBeGreaterThan(3);
    fixture.destroy();
  });

  it("restores the initial order and does not commit after pointer cancellation", () => {
    const fixture = runtimeFixture(["a", "b", "c", "d"]);
    fixture.begin("b", 194);
    dispatchPointer("pointermove", 430);
    fixture.frames.fire(16);
    expect(fixture.runtime.getSnapshot().order).not.toEqual(["a", "b", "c", "d"]);

    dispatchPointer("pointercancel", 430);
    fixture.frames.fire(32);
    fixture.frames.fire(222);

    expect(fixture.runtime.getSnapshot().order).toEqual(["a", "b", "c", "d"]);
    expect(fixture.commitOrder).not.toHaveBeenCalled();
    expect(fixture.cards.get("b")?.host.parentElement).toBe(fixture.cardsLayer);
    fixture.destroy();
  });
});
