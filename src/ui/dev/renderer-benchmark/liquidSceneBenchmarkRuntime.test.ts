import { afterEach, describe, expect, it, vi } from "vitest";
import { BenchmarkSceneStore } from "./benchmarkSceneStore";
import { LiquidSceneBenchmarkRuntime } from "./liquidSceneBenchmarkRuntime";

const liquidCalls = vi.hoisted(() => ({
  containers: [] as unknown[],
  glasses: [] as unknown[],
  groups: [] as Array<{ y: number }>,
}));

vi.mock("@liquid-dom/core", () => {
  class FakeNode {
    x = 0;
    y = 0;
    width = 0;
    height = 0;
    scaleX = 1;
    scaleY = 1;
    zIndex = 0;
    cornerRadius = 0;
    add<T>(child: T) {
      return child;
    }
    remove() {}
  }
  class Scene extends FakeNode {}
  class Group extends FakeNode {
    constructor() {
      super();
      liquidCalls.groups.push(this);
    }
  }
  class Container extends FakeNode {
    constructor(options: unknown) {
      super();
      liquidCalls.containers.push(options);
    }
  }
  class Glass extends FakeNode {
    constructor(options: unknown) {
      super();
      liquidCalls.glasses.push(options);
    }
  }
  class Html extends FakeNode {
    constructor(readonly options: { element: HTMLElement }) {
      super();
    }
  }
  class Renderer {
    readonly canvas = document.createElement("canvas");
    render() {}
    destroy() {}
  }
  return { Container, Glass, Group, Html, Renderer, Scene };
});

afterEach(() => {
  liquidCalls.containers.length = 0;
  liquidCalls.glasses.length = 0;
  liquidCalls.groups.length = 0;
});

describe("LiquidSceneBenchmarkRuntime repeated Canvas Cards", () => {
  it("creates one Browser Container and one shared Card Container for 20 card Glass shapes", () => {
    const store = new BenchmarkSceneStore();
    store.setCanvasCardCount(20);
    const runtime = new LiquidSceneBenchmarkRuntime(() => {});

    runtime.resize(1_280, 900);
    runtime.reconcile(store.scene);

    expect(liquidCalls.containers).toHaveLength(2);
    expect(liquidCalls.containers[1]).toMatchObject({ spacing: 0 });
    expect(liquidCalls.glasses).toHaveLength(21);
    expect(runtime.getCounts()).toMatchObject({ containers: 2, glassShapes: 21 });
    expect(runtime.getCanvasCardHost(19)).toBeInstanceOf(HTMLDivElement);
    runtime.destroy();
  });

  it("changes card Glass count without recreating either shared Container", () => {
    const store = new BenchmarkSceneStore();
    const runtime = new LiquidSceneBenchmarkRuntime(() => {});
    runtime.reconcile(store.scene);
    expect(runtime.getCounts().glassShapes).toBe(6);

    store.setCanvasCardCount(12);
    runtime.reconcile(store.scene);

    expect(liquidCalls.containers).toHaveLength(2);
    expect(runtime.getCounts()).toMatchObject({ containers: 2, glassShapes: 13 });
    runtime.destroy();
  });

  it("batches scrolling into one Scroll Group update without card geometry syncs", () => {
    const store = new BenchmarkSceneStore();
    store.setCanvasCardCount(20);
    const runtime = new LiquidSceneBenchmarkRuntime(() => {});
    runtime.resize(1_280, 900);
    runtime.reconcile(store.scene);
    const before = runtime.getCounts();

    runtime.setCanvasBrowserScroll(48);
    runtime.setCanvasBrowserScroll(96);
    runtime.tick(16);

    expect(runtime.getCounts()).toMatchObject({
      scrollGroupTransformUpdates: before.scrollGroupTransformUpdates + 1,
      cardGeometrySyncs: before.cardGeometrySyncs,
    });
    expect(liquidCalls.groups[0]?.y).toBe(-96);
    runtime.destroy();
  });

  it("routes wheel deltas to the Canvas Browser instead of the canvas camera", () => {
    const store = new BenchmarkSceneStore();
    const runtime = new LiquidSceneBenchmarkRuntime(() => {});
    runtime.resize(1_280, 900);
    runtime.reconcile(store.scene);
    const scroll = document.createElement("div");
    Object.defineProperty(scroll, "clientHeight", { configurable: true, value: 400 });
    runtime.attachCanvasBrowserScrollElement(scroll, () => undefined);

    runtime.scrollCanvasBrowserByWheel(3, 1);
    runtime.tick(16);

    expect(scroll.scrollTop).toBe(48);
    expect(runtime.getCounts().scrollGroupTransformUpdates).toBe(1);
    runtime.destroy();
  });

  it("moves the actual card through an optically identical isolated Drag Container", () => {
    const store = new BenchmarkSceneStore();
    const runtime = new LiquidSceneBenchmarkRuntime(() => {});
    runtime.resize(1_280, 900);
    runtime.reconcile(store.scene);
    const scroll = document.createElement("div");
    const commits: number[][] = [];
    runtime.attachCanvasBrowserScrollElement(scroll, (order) => commits.push([...order]));
    const target = document.createElement("article");
    Object.assign(target, {
      setPointerCapture: vi.fn(),
      hasPointerCapture: vi.fn(() => true),
      releasePointerCapture: vi.fn(),
    });

    runtime.beginCanvasCardDrag(2, pointerEvent("pointerdown", 278), target);
    document.dispatchEvent(pointerEvent("pointermove", 500));
    runtime.tick(16);

    expect(runtime.getCounts().containers).toBe(3);
    const { zIndex: normalZ, ...normalOptics } = liquidCalls.containers[1] as Record<
      string,
      unknown
    >;
    const { zIndex: dragZ, ...dragOptics } = liquidCalls.containers[2] as Record<string, unknown>;
    expect(normalZ).toBe(60);
    expect(dragZ).toBe(80);
    expect(dragOptics).toEqual(normalOptics);
    expect(target.style.opacity).toBe("");
    expect(document.querySelector("[data-benchmark-drag-clone]")).toBeNull();

    document.dispatchEvent(pointerEvent("pointerup", 500));
    runtime.tick(32);
    runtime.tick(240);
    expect(commits).toEqual([[0, 1, 3, 4, 2]]);
    expect(runtime.getCounts().containers).toBe(2);
    runtime.destroy();
  });

  it("keeps midpoint reorder active while edge auto-scroll moves the Scroll Group", () => {
    const store = new BenchmarkSceneStore();
    store.setCanvasCardCount(20);
    const runtime = new LiquidSceneBenchmarkRuntime(() => {});
    runtime.resize(1_280, 900);
    runtime.reconcile(store.scene);
    const scroll = document.createElement("div");
    const commits: number[][] = [];
    runtime.attachCanvasBrowserScrollElement(scroll, (order) => commits.push([...order]));
    const target = document.createElement("article");
    Object.assign(target, {
      setPointerCapture: vi.fn(),
      hasPointerCapture: vi.fn(() => true),
      releasePointerCapture: vi.fn(),
    });

    runtime.beginCanvasCardDrag(7, pointerEvent("pointerdown", 758), target);
    document.dispatchEvent(pointerEvent("pointermove", 880));
    runtime.tick(16);
    expect(scroll.scrollTop).toBeGreaterThan(0);
    expect(runtime.getCounts().scrollGroupTransformUpdates).toBeGreaterThan(0);

    document.dispatchEvent(pointerEvent("pointerup", 880));
    runtime.tick(32);
    runtime.tick(240);
    expect(commits[0]?.indexOf(7)).toBeGreaterThan(7);
    runtime.destroy();
  });
});

function pointerEvent(type: string, clientY: number) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    button: { value: 0 },
    pointerId: { value: 7 },
    clientY: { value: clientY },
  });
  return event as PointerEvent;
}
