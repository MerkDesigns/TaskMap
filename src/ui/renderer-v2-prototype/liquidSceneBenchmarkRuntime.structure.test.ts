import { afterEach, describe, expect, it, vi } from "vitest";
import { BenchmarkSceneStore } from "./benchmarkSceneStore";
import { LiquidSceneBenchmarkRuntime } from "./liquidSceneBenchmarkRuntime";
import { createRendererV2MaterialControls } from "./rendererV2PanelMaterials";
import { createRendererV2PanelGeometry } from "./rendererV2PanelGeometry";

interface LiquidNodeProbe {
  x: number;
  y: number;
  height: number;
  cornerRadius: number;
  parent: LiquidNodeProbe | null;
  children: LiquidNodeProbe[];
}
const liquidCalls = vi.hoisted(() => ({
  containers: [] as unknown[],
  glasses: [] as unknown[],
  containerNodes: [] as LiquidNodeProbe[],
  glassNodes: [] as LiquidNodeProbe[],
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
  liquidCalls.groups.length = 0;
});

describe("LiquidSceneBenchmarkRuntime structure", () => {
  it("uses one Browser Container and one shared Card Container for 20 cards", () => {
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

  it("changes card count without recreating either shared Container", () => {
    const store = new BenchmarkSceneStore();
    const runtime = new LiquidSceneBenchmarkRuntime(() => {});
    runtime.resize(1_280, 900);
    runtime.reconcile(store.scene);
    expect(runtime.getCounts().glassShapes).toBe(6);
    expect(liquidCalls.glassNodes[0]).toMatchObject({ height: 530 });
    store.setCanvasCardCount(12);
    runtime.reconcile(store.scene);
    expect(liquidCalls.containers).toHaveLength(2);
    expect(runtime.getCounts()).toMatchObject({ containers: 2, glassShapes: 13 });
    expect(liquidCalls.glassNodes[0]).toMatchObject({ height: 868 });
    runtime.destroy();
  });

  it("applies live material controls, geometry, and card spacing", () => {
    const runtime = new LiquidSceneBenchmarkRuntime(() => {});
    runtime.resize(1_280, 900);
    runtime.reconcile(new BenchmarkSceneStore().scene);
    const materials = createRendererV2MaterialControls();
    const panelGeometry = createRendererV2PanelGeometry();
    materials["large-panel"] = { ...materials["large-panel"], blur: 24 };
    materials["small-panel"] = {
      ...materials["small-panel"],
      tint: "#336699",
      tintOpacity: 0.4,
      borderOpacity: 0.25,
    };
    panelGeometry["large-panel"] = { cornerRadius: 18 };
    panelGeometry["small-panel"] = { cornerRadius: 9 };
    runtime.setCanvasBrowserAppearance(materials, panelGeometry, 16);
    expect(liquidCalls.containerNodes[0]).toMatchObject({ blur: 24 });
    expect(liquidCalls.containerNodes[1]).toMatchObject({
      specularOpacity: 0.25,
      tint: { r: 0.2, g: 0.4, b: 0.6, a: 0.4 },
    });
    expect(liquidCalls.glassNodes[0]).toMatchObject({ cornerRadius: 18 });
    expect(liquidCalls.glassNodes[1]).toMatchObject({ cornerRadius: 9 });
    expect(liquidCalls.groups[2]).toMatchObject({ y: 174 });
    runtime.destroy();
  });
});
