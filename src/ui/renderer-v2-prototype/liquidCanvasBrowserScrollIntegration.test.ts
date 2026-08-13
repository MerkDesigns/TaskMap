import { describe, expect, it, vi } from "vitest";
import { BenchmarkSceneStore } from "./benchmarkSceneStore";
import { pointerEvent, pointerTarget } from "./canvasCardRuntimeTestSupport";
import { LiquidSceneBenchmarkRuntime } from "./liquidSceneBenchmarkRuntime";

vi.mock("@liquid-dom/core", () => {
  class FakeNode {
    x = 0;
    y = 0;
    width = 0;
    height = 0;
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
  class Group extends FakeNode {}
  class Container extends FakeNode {
    constructor(options: unknown) {
      super();
      Object.assign(this, options);
    }
  }
  class Glass extends Container {}
  class Html extends FakeNode {}
  class Renderer {
    readonly canvas = document.createElement("canvas");
    render() {}
    destroy() {}
  }
  return { Container, Glass, Group, Html, Renderer, Scene };
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
    expect(afterDrag.targetScrollY).toBe(duringDrag.currentScrollY + 40);
    runtime.destroy();
  });
});
