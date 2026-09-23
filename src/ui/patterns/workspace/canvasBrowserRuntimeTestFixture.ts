import { vi } from "vitest";
import { CanvasBrowserRuntime } from "./CanvasBrowserRuntime";
import type { CanvasBrowserFrameDriver } from "./canvasBrowserRuntimeTypes";

export function runtimeFixture(ids: readonly string[], viewportHeight = 400) {
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
  panel.append(viewport);
  viewport.append(sharedGlassPlane, dragGlassPlane, cardsLayer);
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

export function wheel(deltaY: number) {
  return new WheelEvent("wheel", {
    bubbles: true,
    cancelable: true,
    deltaY,
    deltaMode: WheelEvent.DOM_DELTA_PIXEL,
  });
}

export function dispatchPointer(type: string, clientY: number) {
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
