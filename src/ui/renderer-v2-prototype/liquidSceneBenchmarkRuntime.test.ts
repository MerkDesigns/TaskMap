import { afterEach, describe, expect, it, vi } from "vitest";
import { BenchmarkSceneStore } from "./benchmarkSceneStore";
import { pointerEvent, pointerTarget, settleWheel } from "./canvasCardRuntimeTestSupport";
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
    constructor(options?: unknown) {
      super();
      Object.assign(this, options);
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
  it("smoothly renders a coalesced wheel target without card geometry syncs", () => {
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
    const scroll = runtime.getCanvasBrowserScrollState();
    expect(scroll.targetScrollY).toBeCloseTo(43.2);
    expect(scroll.currentScrollY).toBeGreaterThan(0);
    expect(scroll.currentScrollY).toBeLessThan(43.2);
    expect(scroll.scrollGroupY).toBe(-scroll.currentScrollY);
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
    expect(runtime.getCanvasBrowserScrollState().targetScrollY).toBeCloseTo(21.6);
    expect(runtime.getCanvasBrowserScrollState().currentScrollY).toBeLessThan(21.6);
    expect(runtime.getCounts().scrollGroupTransformUpdates).toBe(1);
    runtime.destroy();
  });
  it("scales normal pixel wheel deltas by exactly 0.45 without slot quantization", () => {
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
    const scroll = runtime.getCanvasBrowserScrollState();
    expect(scroll.targetScrollY).toBeCloseTo(1.6875);
    expect(scroll.currentScrollY).toBeGreaterThan(0);
    expect(scroll.currentScrollY).toBeLessThan(1.6875);
    expect(liquidCalls.groups[0]?.y).toBe(-scroll.currentScrollY);
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

    expect(cardGlass(4)).toMatchObject({ y: 0, width: 264, height: 22 });
    expect(cardHtml(4)).toMatchObject({ y: 0, width: 264, height: 84 });
    runtime.scrollCanvasBrowserByWheel(20, 0);
    settleWheel(runtime, 0);
    expect(cardGlass(0)).toMatchObject({ y: 9, width: 264, height: 75, scaleX: 1, scaleY: 1 });
    expect(cardHtml(0)).toMatchObject({ y: -9, width: 264, height: 84 });
    expect(runtime.getCanvasCardHost(0)?.style.transform).toBe("");

    runtime.scrollCanvasBrowserByWheel(180, 0);
    settleWheel(runtime, 1_600);
    expect(cardGlass(0)).toMatchObject({ width: 264, height: 84 });
    expect(cardGlass(0).y).toBeLessThan(-90_000);
    expect(cardHtml(0)).toMatchObject({ width: 264, height: 84 });
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
    settleWheel(runtime, 0);
    runtime.resetCounters();
    const target = document.createElement("article");
    Object.assign(target, {
      setPointerCapture: vi.fn(),
      hasPointerCapture: vi.fn(() => true),
      releasePointerCapture: vi.fn(),
    });

    runtime.beginCanvasCardDrag(7, pointerEvent("pointerdown", 638), target);
    document.dispatchEvent(pointerEvent("pointermove", 860));
    runtime.tick(1_616);
    expect(cardGlass(7).y).toBe(900);
    expect(runtime.getCanvasBrowserScrollState().currentScrollY).toBeGreaterThan(48);
    expect(runtime.getCounts().scrollGroupTransformUpdates).toBe(1);
    document.dispatchEvent(pointerEvent("pointerup", 860));
    runtime.tick(1_632);
    runtime.tick(1_840);
    expect(commits[0]?.indexOf(7)).toBeGreaterThan(7);
    expect(liquidCalls.groups[0]?.y).toBe(-runtime.getCanvasBrowserScrollState().currentScrollY);
    (commits[0] ?? []).forEach((id, index) => {
      expect(liquidCalls.groups[id + 1]?.y).toBe(74 + index * 94);
      expect(cardHtml(id)).toMatchObject({ width: 264, height: 84 });
    });
    expect(runtime.getCounts().containers).toBe(2);
    runtime.destroy();
  });

  it("lets a dragged Glass leave the clip, resolves a valid outside slot, and re-arms", () => {
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
    expect(cardGlass(2)).toMatchObject({ y: -116, width: 264, height: 84 });
    expect(cardGlass(2).parent).toBe(liquidCalls.containerNodes[2]);

    document.dispatchEvent(pointerEvent("pointerup", -100));
    runtime.tick(48);
    expect(runtime.getCounts().containers).toBe(3);
    runtime.tick(238);
    expect(commits).toEqual([[2, 0, 1, 3, 4]]);
    expect(runtime.getCounts().containers).toBe(2);
    expect(cardGlass(2).parent).toBe(normalOwner);
    expect(cardGlass(2)).toMatchObject({ y: 0, width: 264, height: 84 });
    expect(cardHtml(2)).toMatchObject({ y: 0, width: 264, height: 84 });
    expect(firstTarget.releasePointerCapture).toHaveBeenCalledTimes(1);
    expect(runtime.consumeSuppressedCanvasCardClick(2)).toBe(false);

    const finalOrder = commits[0] ?? [];
    finalOrder.forEach((id, index) => {
      expect(liquidCalls.groups[id + 1]?.y).toBe(74 + index * 94);
    });
    const settledGeometry = finalOrder.map((id) => liquidCalls.groups[id + 1]?.y);
    runtime.scrollCanvasBrowserByWheel(2.5, 0);
    runtime.tick(239);
    expect(finalOrder.map((id) => liquidCalls.groups[id + 1]?.y)).toEqual(settledGeometry);
    const wheelScroll = runtime.getCanvasBrowserScrollState();
    expect(wheelScroll.targetScrollY).toBeCloseTo(1.125);
    expect(wheelScroll.currentScrollY).toBeGreaterThan(0);
    expect(wheelScroll.currentScrollY).toBeLessThan(1.125);
    expect(wheelScroll.scrollGroupY).toBe(-wheelScroll.currentScrollY);

    const secondTarget = pointerTarget();
    expect(runtime.beginCanvasCardDrag(1, pointerEvent("pointerdown", 186), secondTarget)).toBe(
      true,
    );
    document.dispatchEvent(pointerEvent("pointermove", 250));
    runtime.tick(240);
    expect(runtime.getCounts().containers).toBe(3);
    const secondCardTop = 74 + finalOrder.indexOf(1) * 94 - wheelScroll.currentScrollY;
    expect(cardGlass(1).y).toBeCloseTo(250 - (186 - secondCardTop));
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
    expect(runtime.getCanvasBrowserScrollState().targetScrollY).toBe(releasedAt);
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
    settleWheel(runtime, 0);
    const target = pointerTarget();

    runtime.beginCanvasCardDrag(7, pointerEvent("pointerdown", 500), target);
    document.dispatchEvent(pointerEvent("pointermove", -40));
    runtime.tick(1_616);
    expect(runtime.getCanvasBrowserScrollState().currentScrollY).toBeLessThan(240);
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
