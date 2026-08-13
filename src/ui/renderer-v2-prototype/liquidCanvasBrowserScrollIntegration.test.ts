import { afterEach, describe, expect, it, vi } from "vitest";
import { BenchmarkSceneStore } from "./benchmarkSceneStore";
import { pointerEvent, pointerTarget } from "./canvasCardRuntimeTestSupport";
import { LiquidSceneBenchmarkRuntime } from "./liquidSceneBenchmarkRuntime";

interface NodeProbe {
  x: number;
  y: number;
  width: number;
  height: number;
  parent: NodeProbe | null;
  host?: HTMLDivElement;
}
const diagnosticNodes = vi.hoisted(() => ({
  groups: [] as NodeProbe[],
  glasses: [] as NodeProbe[],
  html: [] as NodeProbe[],
  renders: 0,
}));
vi.mock("@liquid-dom/core", () => {
  class FakeNode {
    x = 0;
    y = 0;
    width = 0;
    height = 0;
    scaleX = 1;
    scaleY = 1;
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
      diagnosticNodes.groups.push(this);
    }
  }
  class Container extends FakeNode {
    constructor(options: unknown) {
      super();
      Object.assign(this, options);
    }
  }
  class Glass extends Container {
    constructor(options: unknown) {
      super(options);
      diagnosticNodes.glasses.push(this);
    }
  }
  class Html extends FakeNode {
    readonly host = document.createElement("div");
    constructor() {
      super();
      diagnosticNodes.html.push(this);
    }
  }
  class Renderer {
    readonly canvas = document.createElement("canvas");
    render() {
      diagnosticNodes.renders += 1;
    }
    destroy() {}
  }
  return { Container, Glass, Group, Html, Renderer, Scene };
});

afterEach(() => {
  diagnosticNodes.groups.length = 0;
  diagnosticNodes.glasses.length = 0;
  diagnosticNodes.html.length = 0;
  diagnosticNodes.renders = 0;
});

describe("Liquid Canvas Browser smooth-scroll drag integration", () => {
  it("reorders through multiple slots while an outside pointer remains stationary", () => {
    const store = new BenchmarkSceneStore();
    store.setCanvasCardCount(20);
    const runtime = new LiquidSceneBenchmarkRuntime(() => {});
    runtime.resize(1_280, 500);
    runtime.reconcile(store.scene);
    const commits: number[][] = [];
    runtime.attachCanvasBrowserOrderCommit((order) => commits.push([...order]));

    runtime.beginCanvasCardDrag(3, pointerEvent("pointerdown", 392), pointerTarget());
    document.dispatchEvent(pointerEvent("pointermove", 650));
    for (let frame = 1; frame <= 12; frame += 1) runtime.tick(frame * 16);
    document.dispatchEvent(pointerEvent("pointerup", 650));
    runtime.tick(208);
    runtime.tick(398);

    expect(commits).toHaveLength(1);
    expect(commits[0]?.indexOf(3)).toBeGreaterThanOrEqual(5);
    expect(runtime.getCanvasBrowserScrollState().currentScrollY).toBeGreaterThan(150);
    runtime.destroy();
  });

  it("does not snap back when switching wheel to drag auto-scroll and back to wheel", () => {
    const store = new BenchmarkSceneStore();
    store.setCanvasCardCount(20);
    const runtime = new LiquidSceneBenchmarkRuntime(() => {});
    runtime.resize(1_280, 500);
    runtime.reconcile(store.scene);
    runtime.attachCanvasBrowserOrderCommit(() => undefined);
    runtime.scrollCanvasBrowserByWheel(240, 0);
    runtime.tick(16);
    const beforeDrag = runtime.getCanvasBrowserScrollState().currentScrollY;

    runtime.beginCanvasCardDrag(3, pointerEvent("pointerdown", 350), pointerTarget());
    document.dispatchEvent(pointerEvent("pointermove", 650));
    runtime.tick(32);
    const duringDrag = runtime.getCanvasBrowserScrollState();
    expect(duringDrag.currentScrollY).toBeGreaterThan(beforeDrag);
    expect(duringDrag.targetScrollY).toBe(duringDrag.currentScrollY);

    document.dispatchEvent(pointerEvent("pointerup", 650));
    runtime.tick(48);
    runtime.tick(238);
    runtime.scrollCanvasBrowserByWheel(40, 0);
    runtime.tick(254);
    const afterDrag = runtime.getCanvasBrowserScrollState();
    expect(afterDrag.currentScrollY).toBeGreaterThan(duringDrag.currentScrollY);
    expect(afterDrag.targetScrollY).toBe(duringDrag.currentScrollY + 32);
    runtime.destroy();
  });

  it("enables exactly the intended Liquid card components in every diagnostic mode", () => {
    const runtime = new LiquidSceneBenchmarkRuntime(() => {});
    runtime.resize(1_280, 500);
    runtime.reconcile(new BenchmarkSceneStore().scene);
    const cardGroup = diagnosticNodes.groups[1];
    const cardGlass = diagnosticNodes.glasses[1];
    const cardHtml = diagnosticNodes.html[2];

    expect(runtime.getCounts()).toMatchObject({ html: 7, glassShapes: 6 });
    expect(cardGlass?.parent).toBe(cardGroup);
    expect(cardHtml?.parent).toBe(cardGlass);

    runtime.setCanvasBrowserDiagnosticMode("no-card-html");
    expect(runtime.getCounts()).toMatchObject({ html: 2, glassShapes: 6 });
    expect(cardGlass?.parent).toBe(cardGroup);
    expect(cardHtml?.parent).toBeNull();

    runtime.setCanvasBrowserDiagnosticMode("no-card-glass");
    expect(runtime.getCounts()).toMatchObject({ html: 7, glassShapes: 1 });
    expect(cardGlass?.parent).toBeNull();
    expect(cardHtml?.parent).toBe(cardGroup);

    runtime.setCanvasBrowserDiagnosticMode("no-card-glass-or-html");
    expect(runtime.getCounts()).toMatchObject({ html: 2, glassShapes: 1 });
    expect(cardGlass?.parent).toBeNull();
    expect(cardHtml?.parent).toBeNull();
    expect(runtime.canvasBrowserPlaceholderOverlay.children).toHaveLength(5);

    runtime.setCanvasBrowserDiagnosticMode("render-on-demand");
    expect(runtime.getCounts()).toMatchObject({ html: 7, glassShapes: 6 });
    expect(cardGlass?.parent).toBe(cardGroup);
    expect(cardHtml?.parent).toBe(cardGlass);
    runtime.destroy();
  });

  it("requests render-on-demand work for scrolling and becomes idle after smoothing settles", () => {
    const runtime = new LiquidSceneBenchmarkRuntime(() => {});
    runtime.resize(1_280, 500);
    runtime.reconcile(new BenchmarkSceneStore().scene);
    const requestFrame = vi.fn();
    runtime.setFrameRequestListener(requestFrame);
    runtime.tick(0);
    expect(runtime.needsFrame()).toBe(false);

    runtime.scrollCanvasBrowserByWheel(120, 0);
    expect(requestFrame).toHaveBeenCalled();
    expect(runtime.needsFrame()).toBe(true);
    for (let frame = 1; frame <= 100; frame += 1) runtime.tick(frame * 16);

    expect(runtime.needsFrame()).toBe(false);
    expect(diagnosticNodes.renders).toBe(101);
    runtime.destroy();
  });

  it("moves the Scroll Group without rebuilding or reparenting stable card Html", () => {
    const store = new BenchmarkSceneStore();
    store.setCanvasCardCount(20);
    const runtime = new LiquidSceneBenchmarkRuntime(() => {});
    runtime.resize(1_280, 500);
    runtime.reconcile(store.scene);
    const cardHtml = diagnosticNodes.html[2];
    const originalParent = cardHtml?.parent;
    const htmlNodeCount = diagnosticNodes.html.length;

    runtime.scrollCanvasBrowserByWheel(20, 0);
    for (let frame = 1; frame <= 100; frame += 1) runtime.tick(frame * 16);

    expect(diagnosticNodes.groups[0]?.y).toBe(-16);
    expect(cardHtml).toMatchObject({ y: -16, width: 264, height: 84 });
    expect(cardHtml?.parent).toBe(originalParent);
    expect(diagnosticNodes.html).toHaveLength(htmlNodeCount);
    expect(runtime.getCanvasCardHost(0)?.style.transform).toBe("");

    runtime.scrollCanvasBrowserByWheel(400, 0);
    for (let frame = 101; frame <= 200; frame += 1) runtime.tick(frame * 16);
    expect(cardHtml?.parent).toBe(originalParent);
    expect(cardHtml).toMatchObject({ width: 264, height: 84 });
    expect(diagnosticNodes.glasses[1]).toMatchObject({
      width: 264,
      height: 84,
    });
    expect(diagnosticNodes.glasses[1]?.y).toBeLessThan(-90_000);
    runtime.destroy();
  });

  it("wakes for drag and snap, then sleeps on the completion frame", () => {
    const runtime = new LiquidSceneBenchmarkRuntime(() => {});
    runtime.resize(1_280, 500);
    runtime.reconcile(new BenchmarkSceneStore().scene);
    runtime.tick(0);
    const requestFrame = vi.fn();
    runtime.setFrameRequestListener(requestFrame);

    runtime.beginCanvasCardDrag(2, pointerEvent("pointerdown", 278), pointerTarget());
    document.dispatchEvent(pointerEvent("pointermove", 410));
    expect(requestFrame).toHaveBeenCalled();
    runtime.tick(16);
    expect(runtime.needsFrame()).toBe(true);

    document.dispatchEvent(pointerEvent("pointerup", 410));
    runtime.tick(32);
    expect(runtime.needsFrame()).toBe(true);
    runtime.tick(222);
    expect(runtime.needsFrame()).toBe(false);
    runtime.destroy();
  });

  it("allows initial capture, then blocks transform-only paints without blocking card DOM paints", () => {
    const runtime = new LiquidSceneBenchmarkRuntime(() => {});
    runtime.resize(1_280, 500);
    runtime.reconcile(new BenchmarkSceneStore().scene);
    const captureHost = diagnosticNodes.html[2]?.host;
    expect(captureHost).toBeInstanceOf(HTMLDivElement);
    const reachedRenderer = vi.fn();
    runtime.canvas.addEventListener("paint", reachedRenderer);

    const initialCapturePaint = new Event("paint");
    Object.defineProperty(initialCapturePaint, "changedElements", { value: [captureHost] });
    runtime.canvas.dispatchEvent(initialCapturePaint);
    expect(reachedRenderer).toHaveBeenCalledTimes(1);

    const transformPaint = new Event("paint");
    Object.defineProperty(transformPaint, "changedElements", { value: [captureHost] });
    runtime.canvas.dispatchEvent(transformPaint);
    expect(reachedRenderer).toHaveBeenCalledTimes(1);

    const contentPaint = new Event("paint");
    Object.defineProperty(contentPaint, "changedElements", {
      value: [captureHost?.appendChild(document.createElement("span"))],
    });
    runtime.canvas.dispatchEvent(contentPaint);
    expect(reachedRenderer).toHaveBeenCalledTimes(2);
    runtime.destroy();
  });

  it("wakes an idle on-demand runtime when asynchronous Liquid capture completes", () => {
    const runtime = new LiquidSceneBenchmarkRuntime(() => {});
    runtime.resize(1_280, 500);
    runtime.reconcile(new BenchmarkSceneStore().scene);
    runtime.tick(0);
    expect(runtime.needsFrame()).toBe(false);
    const requestFrame = vi.fn();
    runtime.setFrameRequestListener(requestFrame);

    const captureHost = diagnosticNodes.html[2]?.host;
    const content = captureHost?.appendChild(document.createElement("span"));
    const paint = new Event("paint");
    Object.defineProperty(paint, "changedElements", {
      value: [content],
    });
    runtime.canvas.dispatchEvent(paint);

    expect(requestFrame).toHaveBeenCalledTimes(1);
    expect(runtime.needsFrame()).toBe(true);
    runtime.destroy();
  });

  it("coalesces several capture completions into one pending frame", () => {
    const runtime = new LiquidSceneBenchmarkRuntime(() => {});
    runtime.resize(1_280, 500);
    runtime.reconcile(new BenchmarkSceneStore().scene);
    runtime.tick(0);
    let framePending = false;
    const schedule = vi.fn(() => {
      if (framePending) return false;
      framePending = true;
      return true;
    });
    runtime.setFrameRequestListener(schedule);
    const captureHost = diagnosticNodes.html[2]?.host;
    const content = captureHost?.appendChild(document.createElement("span"));

    const firstPaint = new Event("paint");
    Object.defineProperty(firstPaint, "changedElements", { value: [content] });
    runtime.canvas.dispatchEvent(firstPaint);
    const secondPaint = new Event("paint");
    Object.defineProperty(secondPaint, "changedElements", { value: [content] });
    runtime.canvas.dispatchEvent(secondPaint);

    expect(schedule).toHaveBeenCalledTimes(2);
    framePending = false;
    runtime.tick(16);
    expect(runtime.getCounts()).toMatchObject({
      captureCompletionWakeupTotal: 2,
      coalescedInvalidationTotal: 1,
      captureOnlyFrameTotal: 1,
      multiCaptureCompletionFrameTotal: 1,
    });
    runtime.destroy();
  });
});
