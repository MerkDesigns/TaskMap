import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MaterialGeometryFrame, registerMaterialGeometryWork } from "./materialGeometryScheduler";
import { registerNativeGlassGeometry } from "./nativeGlassGeometry";
import { materialRegistry } from "./materialRegistry";
import {
  invalidateMaterialSurfaceGeometry,
  supplyMaterialSurfaceSize,
} from "./materialGeometryInvalidation";

const frames = new Map<number, FrameRequestCallback>();
let nextFrame = 0;
const disposals: (() => void)[] = [];
let resize: ResizeObserverCallback;
const observe = vi.fn();
const unobserve = vi.fn();
const disconnect = vi.fn();
const observerCreated = vi.fn();

beforeEach(() => {
  nextFrame = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: ResizeObserverCallback) {
        resize = callback;
        observerCreated();
      }
      observe = observe;
      unobserve = unobserve;
      disconnect = disconnect;
    },
  );
});

afterEach(() => {
  disposals.splice(0).forEach((dispose) => dispose());
  frames.clear();
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

function frame() {
  const pending = [...frames.values()];
  frames.clear();
  pending.forEach((callback) => callback(16));
}

describe("central material geometry", () => {
  it("keeps layout invalidation authoritative when mixed with scroll in one frame", () => {
    const viewport = document.createElement("div");
    document.body.append(viewport);
    const read = vi.fn();
    const geometry = registerMaterialGeometryWork({ read, scrollRoot: viewport }, [viewport]);
    disposals.push(geometry.dispose);
    viewport.dispatchEvent(new Event("scroll"));
    frame();
    expect(read.mock.lastCall?.[1]).toBe("layout");
    viewport.dispatchEvent(new Event("scroll"));
    frame();
    expect(read.mock.lastCall?.[1]).toBe("scroll");
    viewport.dispatchEvent(new Event("scroll"));
    geometry.invalidate();
    frame();
    expect(read.mock.lastCall?.[1]).toBe("layout");
  });

  it("shares one observer, one frame, and one boundary read; completes all reads before writes", () => {
    const boundary = document.createElement("div");
    const boundaryRead = vi.spyOn(boundary, "getBoundingClientRect");
    const events: string[] = [];
    const jobs = Array.from({ length: 20 }, () => {
      const geometry = registerMaterialGeometryWork(
        {
          read(context) {
            context.rectangle(boundary);
            events.push("read");
            return () => {
              events.push("write");
            };
          },
        },
        [boundary],
      );
      disposals.push(geometry.dispose);
      return geometry;
    });
    jobs.forEach((job) => {
      job.invalidate();
      job.invalidate();
    });
    expect(observerCreated).toHaveBeenCalledOnce();
    expect(observe).toHaveBeenCalledOnce();
    expect(frames.size).toBe(1);
    frame();
    expect(boundaryRead).toHaveBeenCalledOnce();
    expect(events).toEqual([...Array(20).fill("read"), ...Array(20).fill("write")]);
    expect(frames.size).toBe(0);
    const entry = {
      target: boundary,
      borderBoxSize: [],
      contentBoxSize: [],
      devicePixelContentBoxSize: [],
      contentRect: new DOMRect(),
    };
    resize([entry], {} as ResizeObserver);
    resize([entry], {} as ResizeObserver);
    expect(frames.size).toBe(1);
    frame();
    expect(boundaryRead).toHaveBeenCalledTimes(2);
  });

  it("only invalidates the affected scroll subtree and releases shared observations at last consumer", () => {
    const a = document.createElement("div");
    const b = document.createElement("div");
    document.body.append(a, b);
    const readA = vi.fn();
    const readB = vi.fn();
    const first = registerMaterialGeometryWork({ read: readA, scrollRoot: a }, [a]);
    const second = registerMaterialGeometryWork({ read: readB, scrollRoot: b }, [a]);
    disposals.push(first.dispose, second.dispose);
    frame();
    readA.mockClear();
    readB.mockClear();
    a.dispatchEvent(new Event("scroll"));
    a.dispatchEvent(new Event("scroll"));
    frame();
    expect(readA).toHaveBeenCalledOnce();
    expect(readB).not.toHaveBeenCalled();
    first.dispose();
    expect(unobserve).not.toHaveBeenCalled();
    second.dispose();
    expect(unobserve).toHaveBeenCalledOnce();
    expect(disconnect).toHaveBeenCalledOnce();
    disposals.length = 0;
  });

  it("uses owner dimensions without observing or measuring the card, and ignores pure translation", () => {
    const card = document.createElement("div");
    const canvas = document.createElement("canvas");
    const definition = materialRegistry.require("acrylic-small");
    if (definition.strategy !== "native-glass") throw new Error("Expected native Small");
    const measure = vi.spyOn(card, "getBoundingClientRect");
    disposals.push(
      registerNativeGlassGeometry({
        element: card,
        canvas,
        definition,
        radius: 8,
        owned: true,
        shared: true,
        samplingElement: () => null,
      }),
    );
    supplyMaterialSurfaceSize(card, { width: 264, height: 84 });
    frame();
    expect(observe).not.toHaveBeenCalled();
    expect(measure).not.toHaveBeenCalled();
    expect([canvas.width, canvas.height]).toEqual([264, 84]);
    card.style.transform = "translateY(43px)";
    supplyMaterialSurfaceSize(card, { width: 264, height: 84 });
    expect(frames.size).toBe(0);
    const computedStyle = vi.spyOn(window, "getComputedStyle");
    supplyMaterialSurfaceSize(card, { width: 264, height: 42.5 })?.();
    expect(frames.size).toBe(0);
    expect(computedStyle).not.toHaveBeenCalled();
    expect(canvas.height).toBe(43);
    expect(measure).not.toHaveBeenCalled();
  });

  it("runs list ownership before native material reads, including new consumers dirtied by the list", () => {
    const card = document.createElement("div");
    const canvas = document.createElement("canvas");
    const definition = materialRegistry.require("acrylic-small");
    if (definition.strategy !== "native-glass") throw new Error("Expected native Small");
    disposals.push(
      registerNativeGlassGeometry({
        element: card,
        canvas,
        definition,
        radius: 8,
        owned: true,
        shared: true,
        samplingElement: () => null,
      }),
    );
    frame();
    const owner = registerMaterialGeometryWork(
      {
        owner: true,
        read: () => {
          supplyMaterialSurfaceSize(card, { width: 100, height: 50 });
        },
      },
      [],
    );
    disposals.push(owner.dispose);
    frame();
    expect([canvas.width, canvas.height]).toEqual([100, 50]);
    expect(frames.size).toBe(0);
  });

  it("keys rim size to the local border box rather than a transformed screen rectangle", () => {
    const card = document.createElement("div");
    card.style.cssText = "box-sizing:border-box;width:100.5px;height:50.25px";
    document.body.append(card);
    const canvas = document.createElement("canvas");
    const definition = materialRegistry.require("acrylic-small");
    if (definition.strategy !== "native-glass") throw new Error("Expected native Small");
    const rectangle = vi
      .spyOn(card, "getBoundingClientRect")
      .mockReturnValue({ width: 201, height: 100.5 } as DOMRect);
    disposals.push(
      registerNativeGlassGeometry({
        element: card,
        canvas,
        definition,
        radius: 8,
        owned: false,
        shared: true,
        samplingElement: () => null,
      }),
    );
    frame();
    expect([canvas.width, canvas.height]).toEqual([101, 50]);
    invalidateMaterialSurfaceGeometry(card);
    frame();
    expect(rectangle).not.toHaveBeenCalled();
    card.style.cssText =
      "box-sizing:content-box;width:100.5px;height:50.25px;padding:2px;border:1px solid";
    expect(new MaterialGeometryFrame().size(card)).toEqual({ width: 106.5, height: 56.25 });
  });
});
