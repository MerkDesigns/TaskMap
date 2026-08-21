import { beforeEach, describe, expect, it, vi } from "vitest";
import { LIQUID_MATERIAL_OPTICS } from "./materialRoles";

interface NodeRecord {
  readonly options: unknown;
  readonly remove: ReturnType<typeof vi.fn>;
  readonly children: unknown[];
}

const coreState = vi.hoisted(() => ({
  containers: [] as NodeRecord[],
  glasses: [] as NodeRecord[],
  html: [] as NodeRecord[],
  layers: [] as NodeRecord[],
  renderers: [] as Array<{ canvas: HTMLCanvasElement; render: ReturnType<typeof vi.fn> }>,
}));

vi.mock("@liquid-dom/core", () => {
  class MockHtml {
    readonly host = document.createElement("div");
    width = 0;
    height = 0;
    readonly remove = vi.fn();
    readonly children: unknown[] = [];

    constructor(readonly options: { element?: HTMLElement } = {}) {
      if (options.element) this.host.append(options.element);
      coreState.html.push(this);
    }
  }

  class MockGlass {
    x = 0;
    y = 0;
    width = 0;
    height = 0;
    cornerRadius = 0;
    readonly remove = vi.fn();
    readonly children: unknown[] = [];

    constructor(readonly options: unknown) {
      coreState.glasses.push(this);
    }

    add<T>(child: T): T {
      this.children.push(child);
      return child;
    }
  }

  class MockContainer {
    readonly remove = vi.fn();
    readonly children: unknown[] = [];

    constructor(readonly options: unknown) {
      coreState.containers.push(this);
    }

    add<T>(child: T): T {
      this.children.push(child);
      return child;
    }
  }

  class MockScene {
    add<T>(child: T): T {
      return child;
    }
  }

  class MockStackingContext {
    readonly remove = vi.fn();
    readonly children: unknown[] = [];

    constructor(readonly options: unknown) {
      coreState.layers.push(this);
    }

    add<T>(child: T): T {
      this.children.push(child);
      return child;
    }
  }

  class MockRenderer {
    readonly canvas = document.createElement("canvas");
    readonly render = vi.fn();
    readonly destroy = vi.fn();

    constructor() {
      coreState.renderers.push(this);
    }
  }

  return {
    Container: MockContainer,
    Glass: MockGlass,
    Html: MockHtml,
    Renderer: MockRenderer,
    Scene: MockScene,
    StackingContext: MockStackingContext,
  };
});

import { createLiquidDomRuntime } from "./liquidDomRuntime";

describe("Liquid DOM runtime surface ownership", () => {
  beforeEach(() => {
    coreState.containers.length = 0;
    coreState.glasses.length = 0;
    coreState.html.length = 0;
    coreState.layers.length = 0;
    coreState.renderers.length = 0;
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn(() => 1),
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  it("batches by plane and role while surfaces retain local scene order and hierarchy", () => {
    const runtime = createLiquidDomRuntime();
    const first = runtime.registerSurface("large-panel", 10);
    const second = runtime.registerSurface("large-panel", 20);
    const small = runtime.registerSurface("small-panel", 30);
    const overlayLarge = runtime.registerSurface("large-panel", 40, "overlay");
    const overlaySmall = runtime.registerSurface("small-panel", 50, "overlay");

    expect(coreState.containers).toHaveLength(4);
    expect(coreState.containers[0]?.options).toEqual({
      ...LIQUID_MATERIAL_OPTICS["large-panel"],
      zIndex: 0,
    });
    expect(coreState.containers[1]?.options).toEqual({
      ...LIQUID_MATERIAL_OPTICS["small-panel"],
      zIndex: 1,
    });
    expect(coreState.containers[2]?.options).toEqual({
      ...LIQUID_MATERIAL_OPTICS["large-panel"],
      zIndex: 2,
    });
    expect(coreState.containers[3]?.options).toEqual({
      ...LIQUID_MATERIAL_OPTICS["small-panel"],
      zIndex: 3,
    });
    expect(coreState.layers.map(({ options }) => options)).toEqual([
      { zIndex: 10 },
      { zIndex: 20 },
      { zIndex: 30 },
      { zIndex: 40 },
      { zIndex: 50 },
    ]);
    expect(coreState.glasses.map(({ options }) => options)).toEqual([
      { cornerSmoothing: 0, pointerEvents: false },
      { cornerSmoothing: 0, pointerEvents: false },
      { cornerSmoothing: 0, pointerEvents: false },
      { cornerSmoothing: 0, pointerEvents: false },
      { cornerSmoothing: 0, pointerEvents: false },
    ]);
    expect(coreState.containers[0]?.children).toEqual([coreState.layers[0], coreState.layers[1]]);
    expect(coreState.layers[0]?.children).toEqual([coreState.glasses[0]]);
    expect(coreState.glasses[0]?.children).toEqual([coreState.html[1]]);

    first.dispose();
    expect(coreState.glasses[0]?.remove).toHaveBeenCalledOnce();
    expect(coreState.layers[0]?.remove).toHaveBeenCalledOnce();
    expect(coreState.containers[0]?.remove).not.toHaveBeenCalled();

    second.dispose();
    small.dispose();
    overlayLarge.dispose();
    overlaySmall.dispose();
    runtime.destroy();
    coreState.containers.forEach(({ remove }) => expect(remove).toHaveBeenCalledOnce());
  });

  it("coalesces invalidation and wakes once after a Liquid paint", () => {
    let pendingFrame: FrameRequestCallback | null = null;
    const requestFrame = vi.fn((callback: FrameRequestCallback) => {
      pendingFrame = callback;
      return 7;
    });
    vi.stubGlobal("requestAnimationFrame", requestFrame);
    const runtime = createLiquidDomRuntime();

    runtime.invalidate();
    runtime.invalidate();
    expect(requestFrame).toHaveBeenCalledTimes(1);
    (pendingFrame as unknown as FrameRequestCallback)(16);
    expect(coreState.renderers[0]?.render).toHaveBeenCalledOnce();

    coreState.renderers[0]?.canvas.dispatchEvent(new Event("paint"));
    expect(requestFrame).toHaveBeenCalledTimes(2);
    runtime.destroy();
  });
});
