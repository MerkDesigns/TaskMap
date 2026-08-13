import { afterEach, describe, expect, it, vi } from "vitest";
import { BenchmarkSceneStore } from "./benchmarkSceneStore";
import { pointerEvent, pointerTarget } from "./canvasCardRuntimeTestSupport";
import { LiquidSceneBenchmarkRuntime } from "./liquidSceneBenchmarkRuntime";

interface LiquidNodeProbe {
  x: number;
  y: number;
  width: number;
  height: number;
  parent: LiquidNodeProbe | null;
  children: LiquidNodeProbe[];
}
const liquidCalls = vi.hoisted(() => ({
  containers: [] as unknown[],
  glasses: [] as unknown[],
  containerNodes: [] as LiquidNodeProbe[],
  glassNodes: [] as LiquidNodeProbe[],
  htmlNodes: [] as LiquidNodeProbe[],
  groups: [] as LiquidNodeProbe[],
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
    parent: FakeNode | null = null;
    children: FakeNode[] = [];
    add<T>(child: T) {
      if (child instanceof FakeNode) {
        child.remove();
        child.parent = this;
        this.children.push(child);
      }
      return child;
    }
    remove() {
      if (!this.parent) return;
      this.parent.children = this.parent.children.filter((child) => child !== this);
      this.parent = null;
    }
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
      liquidCalls.containerNodes.push(this);
      Object.assign(this, options);
    }
  }
  class Glass extends FakeNode {
    constructor(options: unknown) {
      super();
      liquidCalls.glasses.push(options);
      liquidCalls.glassNodes.push(this);
      Object.assign(this, options);
    }
  }
  class Html extends FakeNode {
    constructor(readonly options: { element: HTMLElement }) {
      super();
      liquidCalls.htmlNodes.push(this);
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
  liquidCalls.containerNodes.length = 0;
  liquidCalls.glassNodes.length = 0;
  liquidCalls.htmlNodes.length = 0;
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
  it("releases a click-only pointer session without waiting for another frame", () => {
    const runtime = new LiquidSceneBenchmarkRuntime(() => {});
    runtime.reconcile(new BenchmarkSceneStore().scene);
    runtime.beginCanvasCardDrag(0, pointerEvent("pointerdown", 100), pointerTarget());
    document.dispatchEvent(pointerEvent("pointerup", 100));
    expect(runtime.beginCanvasCardDrag(1, pointerEvent("pointerdown", 192), pointerTarget())).toBe(
      true,
    );
    expect(runtime.consumeSuppressedCanvasCardClick(0)).toBe(false);
    runtime.destroy();
  });

  it("batches scrolling into one Scroll Group update without card geometry syncs", () => {
    const store = new BenchmarkSceneStore();
    store.setCanvasCardCount(20);
    const runtime = new LiquidSceneBenchmarkRuntime(() => {});
    runtime.resize(1_280, 900);
    runtime.reconcile(store.scene);
    const before = runtime.getCounts();

    runtime.scrollCanvasBrowserByWheel(48, 0);
    runtime.scrollCanvasBrowserByWheel(48, 0);
    runtime.tick(16);
    expect(runtime.getCounts()).toMatchObject({
      scrollGroupTransformUpdates: before.scrollGroupTransformUpdates + 1,
      cardGeometrySyncs: before.cardGeometrySyncs,
    });
    expect(liquidCalls.groups[0]?.y).toBe(-96);
    expect(runtime.getCanvasBrowserScrollState()).toMatchObject({
      currentScrollY: 96,
      pendingDeltaY: 0,
      scrollGroupY: -96,
    });
    runtime.destroy();
  });

  it("routes wheel deltas to the Canvas Browser instead of the canvas camera", () => {
    const store = new BenchmarkSceneStore();
    store.setCanvasCardCount(20);
    const runtime = new LiquidSceneBenchmarkRuntime(() => {});
    runtime.resize(1_280, 900);
    runtime.reconcile(store.scene);
    runtime.attachCanvasBrowserOrderCommit(() => undefined);

    runtime.scrollCanvasBrowserByWheel(3, 1);
    runtime.tick(16);
    expect(runtime.getCanvasBrowserScrollState().currentScrollY).toBe(48);
    expect(runtime.getCounts().scrollGroupTransformUpdates).toBe(1);
    runtime.destroy();
  });

  it("accumulates arbitrary pixel wheel deltas without slot quantization", () => {
    const store = new BenchmarkSceneStore();
    store.setCanvasCardCount(20);
    const runtime = new LiquidSceneBenchmarkRuntime(() => {});
    runtime.resize(1_280, 900);
    runtime.reconcile(store.scene);
    const commitOrder = vi.fn();
    runtime.attachCanvasBrowserOrderCommit(commitOrder);

    runtime.scrollCanvasBrowserByWheel(2.25, 0);
    runtime.tick(16);
    runtime.scrollCanvasBrowserByWheel(1.5, 0);
    runtime.tick(32);
    expect(runtime.getCanvasBrowserScrollState().currentScrollY).toBe(3.75);
    expect(liquidCalls.groups[0]?.y).toBe(-3.75);
    expect(Math.abs(liquidCalls.groups[0]?.y ?? 0)).toBeLessThan(84);
    expect(commitOrder).not.toHaveBeenCalled();
    runtime.destroy();
  });

  it("clips normal cards continuously at both Canvas Browser edges", () => {
    const store = new BenchmarkSceneStore();
    store.setCanvasCardCount(20);
    const runtime = new LiquidSceneBenchmarkRuntime(() => {});
    runtime.resize(1_280, 500);
    runtime.reconcile(store.scene);

    expect(cardGlass(4)).toMatchObject({ y: 0, width: 264, height: 30 });
    expect(cardHtml(4)).toMatchObject({ y: 0, width: 264, height: 30 });
    runtime.scrollCanvasBrowserByWheel(20, 0);
    runtime.tick(16);
    expect(cardGlass(0)).toMatchObject({ y: 20, width: 264, height: 64 });
    expect(cardHtml(0)).toMatchObject({ y: 0, width: 264, height: 64 });
    expect(runtime.getCanvasCardHost(0)?.style.transform).toBe("translate3d(0, -20px, 0)");

    runtime.scrollCanvasBrowserByWheel(180, 0);
    runtime.tick(32);
    expect(cardGlass(0)).toMatchObject({ width: 0, height: 0 });
    expect(cardHtml(0)).toMatchObject({ width: 0, height: 0 });
    runtime.destroy();
  });

  it("moves the actual card through an optically identical isolated Drag Container", () => {
    const store = new BenchmarkSceneStore();
    const runtime = new LiquidSceneBenchmarkRuntime(() => {});
    runtime.resize(1_280, 900);
    runtime.reconcile(store.scene);
    const commits: number[][] = [];
    runtime.attachCanvasBrowserOrderCommit((order) => commits.push([...order]));
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
    expect(runtime.consumeSuppressedCanvasCardClick(2)).toBe(true);
    expect(runtime.consumeSuppressedCanvasCardClick(2)).toBe(false);
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
    const commits: number[][] = [];
    runtime.attachCanvasBrowserOrderCommit((order) => commits.push([...order]));
    runtime.scrollCanvasBrowserByWheel(120, 0);
    runtime.tick(0);
    runtime.resetCounters();
    runtime.scrollCanvasBrowserByWheel(10, 0);
    const target = document.createElement("article");
    Object.assign(target, {
      setPointerCapture: vi.fn(),
      hasPointerCapture: vi.fn(() => true),
      releasePointerCapture: vi.fn(),
    });

    runtime.beginCanvasCardDrag(7, pointerEvent("pointerdown", 638), target);
    document.dispatchEvent(pointerEvent("pointermove", 860));
    runtime.tick(16);
    expect(cardGlass(7).y).toBe(820);
    expect(runtime.getCanvasBrowserScrollState().currentScrollY).toBeGreaterThan(130);
    expect(runtime.getCounts().scrollGroupTransformUpdates).toBe(1);
    document.dispatchEvent(pointerEvent("pointerup", 860));
    runtime.tick(32);
    runtime.tick(240);
    expect(commits[0]?.indexOf(7)).toBeGreaterThan(7);
    expect(liquidCalls.groups[0]?.y).toBe(-runtime.getCanvasBrowserScrollState().currentScrollY);
    (commits[0] ?? []).forEach((id, index) => {
      expect(liquidCalls.groups[id + 1]?.y).toBe(74 + index * 92);
      expect(cardHtml(id).y).toBe(0);
      expect(cardHtml(id).height).toBe(cardGlass(id).height);
    });
    expect(runtime.getCounts().containers).toBe(2);
    runtime.destroy();
  });

  it("lets a dragged Glass leave the clip, snaps to its last valid slot, and re-arms immediately", () => {
    const store = new BenchmarkSceneStore();
    const runtime = new LiquidSceneBenchmarkRuntime(() => {});
    runtime.resize(1_280, 500);
    runtime.reconcile(store.scene);
    const commits: number[][] = [];
    runtime.attachCanvasBrowserOrderCommit((order) => commits.push([...order]));
    const firstTarget = pointerTarget();
    const normalOwner = cardGlass(2).parent;

    expect(runtime.beginCanvasCardDrag(2, pointerEvent("pointerdown", 278), firstTarget)).toBe(
      true,
    );
    document.dispatchEvent(pointerEvent("pointermove", 450));
    runtime.tick(16);
    document.dispatchEvent(pointerEvent("pointermove", -100));
    runtime.tick(32);
    expect(cardGlass(2)).toMatchObject({ y: -120, width: 264, height: 84 });
    expect(cardGlass(2).parent).toBe(liquidCalls.containerNodes[2]);

    document.dispatchEvent(pointerEvent("pointerup", -100));
    runtime.tick(48);
    expect(runtime.getCounts().containers).toBe(3);
    runtime.tick(238);
    expect(commits).toEqual([[0, 1, 3, 2, 4]]);
    expect(runtime.getCounts().containers).toBe(2);
    expect(cardGlass(2).parent).toBe(normalOwner);
    expect(cardGlass(2)).toMatchObject({ y: 0, width: 264, height: 84 });
    expect(cardHtml(2)).toMatchObject({ y: 0, width: 264, height: 84 });
    expect(firstTarget.releasePointerCapture).toHaveBeenCalledTimes(1);
    expect(runtime.consumeSuppressedCanvasCardClick(2)).toBe(false);

    const finalOrder = commits[0] ?? [];
    finalOrder.forEach((id, index) => {
      expect(liquidCalls.groups[id + 1]?.y).toBe(74 + index * 92);
    });
    const settledGeometry = finalOrder.map((id) => liquidCalls.groups[id + 1]?.y);
    runtime.scrollCanvasBrowserByWheel(2.5, 0);
    runtime.tick(239);
    expect(finalOrder.map((id) => liquidCalls.groups[id + 1]?.y)).toEqual(settledGeometry);
    expect(runtime.getCanvasBrowserScrollState()).toMatchObject({
      currentScrollY: 2.5,
      pendingDeltaY: 0,
      scrollGroupY: -2.5,
    });

    const secondTarget = pointerTarget();
    expect(runtime.beginCanvasCardDrag(1, pointerEvent("pointerdown", 186), secondTarget)).toBe(
      true,
    );
    document.dispatchEvent(pointerEvent("pointermove", 250));
    runtime.tick(240);
    expect(runtime.getCounts().containers).toBe(3);
    expect(cardGlass(1).y).toBe(227.5);
    runtime.destroy();
  });

  it("stops edge auto-scroll as soon as release begins", () => {
    const store = new BenchmarkSceneStore();
    store.setCanvasCardCount(20);
    const runtime = new LiquidSceneBenchmarkRuntime(() => {});
    runtime.resize(1_280, 900);
    runtime.reconcile(store.scene);
    runtime.attachCanvasBrowserOrderCommit(() => undefined);
    const target = pointerTarget();

    runtime.beginCanvasCardDrag(7, pointerEvent("pointerdown", 758), target);
    document.dispatchEvent(pointerEvent("pointermove", 850));
    runtime.tick(16);
    const releasedAt = runtime.getCanvasBrowserScrollState().currentScrollY;
    expect(releasedAt).toBeGreaterThan(0);

    document.dispatchEvent(pointerEvent("pointerup", 850));
    runtime.tick(32);
    runtime.tick(222);
    runtime.tick(500);
    expect(runtime.getCanvasBrowserScrollState().currentScrollY).toBe(releasedAt);
    expect(runtime.getCanvasBrowserScrollState().pendingDeltaY).toBe(0);
    runtime.destroy();
  });

  it("continues drag auto-scroll while the document pointer is outside the browser", () => {
    const store = new BenchmarkSceneStore();
    store.setCanvasCardCount(20);
    const runtime = new LiquidSceneBenchmarkRuntime(() => {});
    runtime.resize(1_280, 900);
    runtime.reconcile(store.scene);
    runtime.attachCanvasBrowserOrderCommit(() => undefined);
    runtime.scrollCanvasBrowserByWheel(300, 0);
    runtime.tick(0);
    const target = pointerTarget();

    runtime.beginCanvasCardDrag(7, pointerEvent("pointerdown", 500), target);
    document.dispatchEvent(pointerEvent("pointermove", -40));
    runtime.tick(16);
    expect(runtime.getCanvasBrowserScrollState().currentScrollY).toBeLessThan(300);
    expect(runtime.getCounts().scrollGroupTransformUpdates).toBeGreaterThan(1);
    runtime.destroy();
  });
});

function cardGlass(id: number) {
  return liquidCalls.glassNodes[id + 1];
}

function cardHtml(id: number) {
  return liquidCalls.htmlNodes[id + 2];
}
