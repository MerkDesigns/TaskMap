// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { worldToScreen } from "../../../canvas/geometry/viewportMath";
import { BenchmarkSceneStore } from "./benchmarkSceneStore";
import { BenchmarkViewportController } from "./benchmarkViewportController";

afterEach(() => vi.unstubAllGlobals());

describe("benchmark viewport controller", () => {
  it("keeps zoom pointer-centered and converts spawn coordinates under pan and zoom", () => {
    vi.stubGlobal("requestAnimationFrame", () => 1);
    vi.stubGlobal("cancelAnimationFrame", () => undefined);
    const store = new BenchmarkSceneStore();
    const controller = new BenchmarkViewportController(store);
    controller.resize({ width: 1200, height: 800 });
    const pointer = { x: 470, y: 310 };
    const worldBefore = controller.worldAt(pointer);

    controller.wheel(pointer, -100);

    expect(worldToScreen(worldBefore, store.scene.camera)).toEqual(pointer);
    expect(controller.worldAt(pointer)).toEqual(worldBefore);
    const spawned = store.addElement("text-card", controller.worldAt(pointer));
    expect({ x: spawned.x, y: spawned.y }).toEqual(worldBefore);
  });

  it("batches pointer camera presentation without publishing scene changes", () => {
    let pendingFrame: FrameRequestCallback | null = null;
    const requestFrame = vi.fn((callback: FrameRequestCallback) => {
      pendingFrame = callback;
      return 7;
    });
    vi.stubGlobal("requestAnimationFrame", requestFrame);
    vi.stubGlobal("cancelAnimationFrame", () => undefined);
    const store = new BenchmarkSceneStore();
    const controller = new BenchmarkViewportController(store);
    const present = vi.fn();
    const publish = vi.fn();
    controller.bindPresenter(present);
    store.subscribe(publish);
    const version = store.getVersion();

    controller.beginPan(3, { x: 10, y: 20 });
    controller.updatePan(3, { x: 30, y: 50 });
    controller.updatePan(3, { x: 50, y: 80 });

    expect(requestFrame).toHaveBeenCalledTimes(1);
    expect(present).toHaveBeenCalledTimes(1);
    expect(publish).not.toHaveBeenCalled();
    expect(store.getVersion()).toBe(version);
    expect(store.scene.camera.pan).toEqual({ x: 120, y: 124 });

    (pendingFrame as unknown as FrameRequestCallback)(16);
    expect(present).toHaveBeenCalledTimes(2);
  });
});
