import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BenchmarkSceneStore } from "./benchmarkSceneStore";
import { BenchmarkViewportController } from "./benchmarkViewportController";
import { useBenchmarkVisibleElements } from "./useBenchmarkVisibleElements";

afterEach(() => vi.unstubAllGlobals());

describe("benchmark visible elements", () => {
  it("keeps the derived element array stable across non-structural rerenders", () => {
    vi.stubGlobal("requestAnimationFrame", () => 1);
    vi.stubGlobal("cancelAnimationFrame", () => undefined);
    const store = new BenchmarkSceneStore();
    const viewport = new BenchmarkViewportController(store);
    const { result, rerender } = renderHook(
      ({ version }) => useBenchmarkVisibleElements(store, viewport, version),
      { initialProps: { version: store.getVersion() } },
    );
    const first = result.current.elements;

    rerender({ version: store.getVersion() });

    expect(result.current.elements).toBe(first);
  });

  it("refreshes the derived element array after a structural publication", () => {
    vi.stubGlobal("requestAnimationFrame", () => 1);
    vi.stubGlobal("cancelAnimationFrame", () => undefined);
    const store = new BenchmarkSceneStore();
    const viewport = new BenchmarkViewportController(store);
    const { result, rerender } = renderHook(
      ({ version }) => useBenchmarkVisibleElements(store, viewport, version),
      { initialProps: { version: store.getVersion() } },
    );
    const first = result.current.elements;
    store.addElement("text-card");

    rerender({ version: store.getVersion() });

    expect(result.current.elements).not.toBe(first);
  });
});
