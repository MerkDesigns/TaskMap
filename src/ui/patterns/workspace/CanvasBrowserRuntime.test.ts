import { afterEach, describe, expect, it, vi } from "vitest";
import { CANVAS_CARD_SLOT_TRANSITION_MS, easeOutQuart } from "./canvasBrowserInteraction";
import { CANVAS_BROWSER_LAYOUT } from "./canvasBrowserLayout";
import { CanvasBrowserRuntime } from "./CanvasBrowserRuntime";
import type { CanvasBrowserFrameDriver } from "./canvasBrowserRuntimeTypes";

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("production Canvas Browser runtime", () => {
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

  it("shortens top and bottom card shells continuously while preserving full content geometry", () => {
    const fixture = runtimeFixture(["a", "b", "c"], 100);
    const firstHost = fixture.cards.get("a")!.host;
    const secondHost = fixture.cards.get("b")!.host;

    expect(firstHost.style.getPropertyValue("--taskmap-canvas-card-visible-height")).toBe("84px");
    expect(secondHost.style.getPropertyValue("--taskmap-canvas-card-visible-height")).toBe("6px");
    expect(secondHost.style.getPropertyValue("--taskmap-canvas-card-clip-offset")).toBe("0px");

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
    expect(
      Number.parseFloat(firstHost.style.getPropertyValue("--taskmap-canvas-card-clip-offset")),
    ).toBeGreaterThan(firstOffset);
    fixture.destroy();
  });

  it("restores a partial rounded shell after the actual card leaves and rejoins the list", () => {
    const fixture = runtimeFixture(["a", "b", "c"], 100);
    const secondHost = fixture.cards.get("b")!.host;
    expect(secondHost.style.getPropertyValue("--taskmap-canvas-card-visible-height")).toBe("6px");

    fixture.begin("b", 171);
    dispatchPointer("pointermove", 177);
    fixture.frames.fire(16);
    expect(secondHost.parentElement).toHaveAttribute("data-canvas-browser-drag-layer");
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

  it("reparents the actual card, performs multi-slot reorder, and commits once after 190ms", () => {
    const fixture = runtimeFixture(["a", "b", "c", "d", "e"]);
    const record = fixture.cards.get("a")!;
    const originalCard = record.card;

    fixture.begin("a", 100);
    dispatchPointer("pointermove", 650);
    fixture.frames.fire(16);

    expect(record.card).toBe(originalCard);
    expect(record.host.parentElement).toHaveAttribute("data-canvas-browser-drag-layer");
    expect(record.card).not.toHaveAttribute("data-material-motion");
    expect(fixture.sharedGlassPlane.querySelectorAll("rect")).toHaveLength(4);
    expect(fixture.dragGlassPlane.querySelectorAll("rect")).toHaveLength(1);
    expect(document.querySelector("[data-canvas-card-placeholder]")).toBeNull();
    expect(fixture.runtime.getSnapshot().order).toEqual(["b", "c", "d", "e", "a"]);
    expect(fixture.commitOrder).not.toHaveBeenCalled();

    dispatchPointer("pointerup", 650);
    fixture.frames.fire(32);
    const snapFrom = Number.parseFloat(record.host.style.top);
    const target = 74 + 4 * 94 - fixture.runtime.getSnapshot().scroll.currentScrollY;
    fixture.frames.fire(32 + CANVAS_CARD_SLOT_TRANSITION_MS / 2);
    const halfway = Number.parseFloat(record.host.style.top);
    expect(halfway).toBeCloseTo(snapFrom + (target - snapFrom) * easeOutQuart(0.5));
    expect(record.host.parentElement).toHaveAttribute("data-canvas-browser-drag-layer");

    fixture.frames.fire(32 + CANVAS_CARD_SLOT_TRANSITION_MS);
    expect(record.card).toBe(originalCard);
    expect(record.host.parentElement).toBe(fixture.cardsLayer);
    expect(record.card).not.toHaveAttribute("data-material-motion");
    expect(fixture.sharedGlassPlane.querySelectorAll("rect")).toHaveLength(5);
    expect(fixture.dragGlassPlane.querySelectorAll("rect")).toHaveLength(0);
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

function runtimeFixture(ids: readonly string[], viewportHeight = 400) {
  const panel = document.createElement("aside");
  const viewport = document.createElement("div");
  const sharedGlassPlane = document.createElement("div");
  const dragGlassPlane = document.createElement("div");
  const definitions = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const clip = document.createElementNS("http://www.w3.org/2000/svg", "clipPath");
  clip.dataset.sharedSmallGlassClip = "true";
  definitions.append(clip);
  sharedGlassPlane.append(definitions);
  const dragDefinitions = definitions.cloneNode(true) as SVGSVGElement;
  dragGlassPlane.append(dragDefinitions);
  const cardsLayer = document.createElement("div");
  panel.append(viewport, dragGlassPlane);
  viewport.append(sharedGlassPlane, cardsLayer);
  document.body.append(panel);
  Object.defineProperty(viewport, "clientHeight", { configurable: true, value: viewportHeight });
  viewport.getBoundingClientRect = () => rectangle(74, viewportHeight, 288, 16);
  const frames = new ControlledFrameDriver();
  const commitOrder = vi.fn();
  const runtime = new CanvasBrowserRuntime<string>({
    panel,
    viewport,
    cardsLayer,
    sharedSmallGlassPlane: sharedGlassPlane,
    dragSmallGlassPlane: dragGlassPlane,
    commitOrder,
    frameDriver: frames,
  });
  const cards = new Map<string, { host: HTMLDivElement; card: HTMLElement }>();
  ids.forEach((id, index) => {
    const host = document.createElement("div");
    const card = document.createElement("article");
    card.dataset.canvasCardId = id;
    card.dataset.materialBackdropSource = "shared";
    card.style.setProperty("--taskmap-material-radius", "13.5px");
    Object.assign(card, {
      setPointerCapture: vi.fn(),
      hasPointerCapture: vi.fn(() => true),
      releasePointerCapture: vi.fn(),
    });
    card.getBoundingClientRect = () => {
      const dragging = host.dataset.dragging === "true";
      const top = dragging ? Number.parseFloat(host.style.top) : 74 + index * 94;
      return rectangle(top, 84, 264, 28);
    };
    host.append(card);
    cardsLayer.append(host);
    cards.set(id, { host, card });
    runtime.register(id, host, card);
  });
  runtime.reconcile(ids);

  return {
    runtime,
    frames,
    commitOrder,
    cards,
    cardsLayer,
    sharedGlassPlane,
    dragGlassPlane,
    panel,
    viewport,
    begin(id: string, clientY: number) {
      const card = cards.get(id)!.card;
      runtime.beginDrag(id, pointer("pointerdown", clientY), card);
    },
    destroy() {
      runtime.destroy();
    },
  };
}

function wheel(deltaY: number) {
  return new WheelEvent("wheel", {
    bubbles: true,
    cancelable: true,
    deltaY,
    deltaMode: WheelEvent.DOM_DELTA_PIXEL,
  });
}

function dispatchPointer(type: string, clientY: number) {
  document.dispatchEvent(pointer(type, clientY));
}

function pointer(type: string, clientY: number) {
  const event = new Event(type, { bubbles: true, cancelable: true }) as PointerEvent;
  Object.defineProperties(event, {
    pointerId: { value: 7 },
    button: { value: 0 },
    clientY: { value: clientY },
  });
  return event;
}

function rectangle(top: number, height: number, width: number, left: number): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    toJSON: () => ({}),
  };
}

class ControlledFrameDriver implements CanvasBrowserFrameDriver {
  private callbacks = new Map<number, FrameRequestCallback>();
  private nextHandle = 1;

  request(callback: FrameRequestCallback) {
    const handle = this.nextHandle++;
    this.callbacks.set(handle, callback);
    return handle;
  }

  cancel(handle: number) {
    this.callbacks.delete(handle);
  }

  fire(timestamp: number) {
    const entry = this.callbacks.entries().next().value as
      [number, FrameRequestCallback] | undefined;
    if (!entry) return false;
    this.callbacks.delete(entry[0]);
    entry[1](timestamp);
    return true;
  }

  flush(limit: number) {
    for (let frame = 1; frame <= limit && this.fire(frame * 16); frame += 1) {
      // The production runtime owns one pending frame at a time.
    }
  }
}
