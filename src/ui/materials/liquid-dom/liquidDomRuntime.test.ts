import { beforeEach, describe, expect, it, vi } from "vitest";
import { LIQUID_MATERIAL_OPTICS } from "./materialRoles";

interface NodeRecord {
  readonly options: unknown;
  readonly remove: ReturnType<typeof vi.fn>;
}

const coreState = vi.hoisted(() => ({
  containers: [] as NodeRecord[],
  glasses: [] as NodeRecord[],
  layers: [] as NodeRecord[],
  renderers: [] as Array<{ canvas: HTMLCanvasElement; render: ReturnType<typeof vi.fn> }>,
}));

vi.mock("@liquid-dom/core", () => {
  class MockHtml {
    readonly host = document.createElement("div");
    width = 0;
    height = 0;
    readonly remove = vi.fn();

    constructor(options: { element?: HTMLElement } = {}) {
      if (options.element) this.host.append(options.element);
    }
  }

  class MockGlass {
    x = 0;
    y = 0;
    width = 0;
    height = 0;
    cornerRadius = 0;
    readonly remove = vi.fn();

    constructor(readonly options: unknown) {
      coreState.glasses.push(this);
    }

    add<T>(child: T): T {
      return child;
    }
  }

  class MockContainer {
    readonly remove = vi.fn();

    constructor(readonly options: unknown) {
      coreState.containers.push(this);
    }

    add<T>(child: T): T {
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

    constructor(readonly options: unknown) {
      coreState.layers.push(this);
    }

    add<T>(child: T): T {
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
    coreState.layers.length = 0;
    coreState.renderers.length = 0;
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn(() => 1),
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  it("shares one material Container per role while surfaces retain local scene order", () => {
    const runtime = createLiquidDomRuntime();
    const first = runtime.registerSurface("large-panel", 10);
    const second = runtime.registerSurface("large-panel", 20);
    const small = runtime.registerSurface("small-panel", 30);

    expect(coreState.containers).toHaveLength(2);
    expect(coreState.containers[0]?.options).toEqual({
      ...LIQUID_MATERIAL_OPTICS["large-panel"],
      zIndex: 0,
    });
    expect(coreState.containers[1]?.options).toEqual({
      ...LIQUID_MATERIAL_OPTICS["small-panel"],
      zIndex: 1,
    });
    expect(coreState.layers.map(({ options }) => options)).toEqual([
      { zIndex: 10 },
      { zIndex: 20 },
      { zIndex: 30 },
    ]);
    expect(coreState.glasses.map(({ options }) => options)).toEqual([
      { cornerSmoothing: 0, pointerEvents: false },
      { cornerSmoothing: 0, pointerEvents: false },
      { cornerSmoothing: 0, pointerEvents: false },
    ]);

    first.dispose();
    expect(coreState.glasses[0]?.remove).toHaveBeenCalledOnce();
    expect(coreState.layers[0]?.remove).toHaveBeenCalledOnce();
    expect(coreState.containers[0]?.remove).not.toHaveBeenCalled();

    second.dispose();
    small.dispose();
    runtime.destroy();
    expect(coreState.containers[0]?.remove).toHaveBeenCalledOnce();
    expect(coreState.containers[1]?.remove).toHaveBeenCalledOnce();
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
