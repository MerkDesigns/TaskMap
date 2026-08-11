import { beforeEach, describe, expect, it, vi } from "vitest";
import { LIQUID_MATERIAL_OPTICS } from "./materialRoles";

interface ContainerRecord {
  readonly options: unknown;
  readonly remove: ReturnType<typeof vi.fn>;
}

interface GlassRecord {
  readonly options: unknown;
  readonly remove: ReturnType<typeof vi.fn>;
}

const coreState = vi.hoisted(() => ({
  containers: [] as ContainerRecord[],
  glasses: [] as GlassRecord[],
}));

vi.mock("@liquid-dom/core", () => {
  class MockHtml {
    readonly host = document.createElement("div");
    width = 0;
    height = 0;
    readonly remove = vi.fn();

    constructor(options: { element?: HTMLElement } = {}) {
      if (options.element) {
        this.host.append(options.element);
      }
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

  class MockRenderer {
    readonly canvas = document.createElement("canvas");
    readonly render = vi.fn();
    readonly destroy = vi.fn();
  }

  return {
    Container: MockContainer,
    Glass: MockGlass,
    Html: MockHtml,
    Renderer: MockRenderer,
    Scene: MockScene,
  };
});

import { createLiquidDomRuntime } from "./liquidDomRuntime";

describe("Liquid DOM runtime surface ownership", () => {
  beforeEach(() => {
    coreState.containers.length = 0;
    coreState.glasses.length = 0;
  });

  it("creates and disposes an independent Container for every surface", () => {
    const runtime = createLiquidDomRuntime();
    const first = runtime.registerSurface("large-panel");
    const second = runtime.registerSurface("large-panel");

    expect(coreState.containers).toHaveLength(2);
    expect(coreState.containers[0]?.options).toBe(LIQUID_MATERIAL_OPTICS["large-panel"]);
    expect(coreState.containers[1]?.options).toBe(LIQUID_MATERIAL_OPTICS["large-panel"]);
    expect(coreState.containers[0]).not.toBe(coreState.containers[1]);
    expect(coreState.glasses.map(({ options }) => options)).toEqual([
      { cornerSmoothing: 0, pointerEvents: false },
      { cornerSmoothing: 0, pointerEvents: false },
    ]);

    first.dispose();
    expect(coreState.glasses[0]?.remove).toHaveBeenCalledOnce();
    expect(coreState.containers[0]?.remove).toHaveBeenCalledOnce();
    expect(coreState.containers[1]?.remove).not.toHaveBeenCalled();

    second.dispose();
    expect(coreState.glasses[1]?.remove).toHaveBeenCalledOnce();
    expect(coreState.containers[1]?.remove).toHaveBeenCalledOnce();
  });
});
