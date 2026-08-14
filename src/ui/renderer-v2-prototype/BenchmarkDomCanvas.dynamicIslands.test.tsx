import { act, render } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { describe, expect, it, vi } from "vitest";
import { BenchmarkDomCanvas } from "./BenchmarkDomCanvas";
import { BenchmarkSceneStore } from "./benchmarkSceneStore";
import { BenchmarkViewportController } from "./benchmarkViewportController";
import type { DynamicElementClassification } from "./dynamicCanvasIslands";
import type { LiquidSceneBenchmarkRuntime } from "./liquidSceneBenchmarkRuntime";

class DynamicRuntimeDouble {
  readonly coarseHost = document.createElement("div");
  readonly canvas = document.createElement("canvas");
  readonly hosts = new Map<string, HTMLDivElement>();
  attachCount = 0;
  detachCount = 0;
  constructor() {
    Object.defineProperties(this.canvas, {
      clientWidth: { value: 4_000 },
      clientHeight: { value: 3_000 },
    });
  }
  reconcileDynamicElements(classifications: readonly DynamicElementClassification[]) {
    let changed = false;
    const desired = new Set(classifications.map(({ element }) => element.id));
    for (const [id, host] of this.hosts) {
      if (desired.has(id)) continue;
      host.remove();
      this.hosts.delete(id);
      this.detachCount += 1;
      changed = true;
    }
    for (const id of desired) {
      if (this.hosts.has(id)) continue;
      this.hosts.set(id, document.createElement("div"));
      this.attachCount += 1;
      changed = true;
    }
    return changed;
  }
  hasDynamicElement = (id: string) => this.hosts.has(id);
  getDynamicElementHost = (id: string) => this.hosts.get(id) ?? null;
  presentDynamicCamera = vi.fn();
  presentDynamicElementPosition = vi.fn();
  syncDynamicElement = vi.fn();
  invalidateFrame = vi.fn();
  tick = vi.fn();
  getCounts = vi.fn(() => ({}));
  resetCounters = vi.fn();
  needsFrame = vi.fn(() => false);
  setFrameRequestListener = vi.fn();
}

describe("Benchmark DOM Canvas dynamic island presentation", () => {
  it("moves promoted markup out of the coarse DOM once and restores it when animation stops", () => {
    const store = new BenchmarkSceneStore();
    const viewport = new BenchmarkViewportController(store);
    viewport.resize({ width: 4_000, height: 3_000 });
    const runtime = new DynamicRuntimeDouble();
    store.setAnimation("moveCards", true);

    const view = render(
      <MantineProvider>
        <BenchmarkDomCanvas
          store={store}
          viewport={viewport}
          version={store.getVersion()}
          runtime={runtime as unknown as LiquidSceneBenchmarkRuntime}
          onPresentation={vi.fn()}
          onSpawnMenu={vi.fn()}
          canvasIslandMode="dynamic-islands"
        />
      </MantineProvider>,
    );

    expect(runtime.attachCount).toBe(2);
    expect(runtime.detachCount).toBe(0);
    expect(runtime.coarseHost.querySelectorAll("[data-benchmark-element]")).toHaveLength(6);
    expect(
      [...runtime.hosts.values()].flatMap((host) => [
        ...host.querySelectorAll("[data-benchmark-element]"),
      ]),
    ).toHaveLength(2);

    act(() => store.setAnimation("moveCards", false));
    view.rerender(
      <MantineProvider>
        <BenchmarkDomCanvas
          store={store}
          viewport={viewport}
          version={store.getVersion()}
          runtime={runtime as unknown as LiquidSceneBenchmarkRuntime}
          onPresentation={vi.fn()}
          onSpawnMenu={vi.fn()}
          canvasIslandMode="dynamic-islands"
        />
      </MantineProvider>,
    );

    expect(runtime.hosts.size).toBe(0);
    expect(runtime.attachCount).toBe(2);
    expect(runtime.detachCount).toBe(2);
    expect(runtime.coarseHost.querySelectorAll("[data-benchmark-element]")).toHaveLength(8);
    viewport.dispose();
  });

  it("keeps every element in the coarse DOM in comparison mode", () => {
    const store = new BenchmarkSceneStore();
    const viewport = new BenchmarkViewportController(store);
    viewport.resize({ width: 4_000, height: 3_000 });
    const runtime = new DynamicRuntimeDouble();
    store.setAnimation("moveCards", true);

    render(
      <MantineProvider>
        <BenchmarkDomCanvas
          store={store}
          viewport={viewport}
          version={store.getVersion()}
          runtime={runtime as unknown as LiquidSceneBenchmarkRuntime}
          onPresentation={vi.fn()}
          onSpawnMenu={vi.fn()}
          canvasIslandMode="coarse-canvas"
        />
      </MantineProvider>,
    );

    expect(runtime.attachCount).toBe(0);
    expect(runtime.coarseHost.querySelectorAll("[data-benchmark-element]")).toHaveLength(8);
    viewport.dispose();
  });
});
