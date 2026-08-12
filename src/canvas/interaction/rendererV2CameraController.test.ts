// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createViewport, screenToWorld, worldToScreen } from "../geometry/viewportMath";
import {
  createRendererV2CameraController,
  type CameraFrameScheduler,
} from "./rendererV2CameraController";

function createHarness() {
  const pending = new Map<number, () => void>();
  let nextFrame = 1;
  const frames: CameraFrameScheduler = {
    request(callback) {
      const handle = nextFrame++;
      pending.set(handle, callback);
      return handle;
    },
    cancel(handle) {
      pending.delete(handle);
    },
  };
  const present = vi.fn();
  const controller = createRendererV2CameraController({
    initialViewport: createViewport({ x: 100, y: 60 }, 1, { width: 1000, height: 700 }),
    frames,
    present,
  });
  const flush = () => {
    const callbacks = [...pending.values()];
    pending.clear();
    callbacks.forEach((callback) => callback());
  };
  return { controller, pending, present, flush };
}

describe("Renderer V2 camera controller", () => {
  it("translates the camera by pointer deltas and batches presentation frames", () => {
    const { controller, pending, present, flush } = createHarness();

    expect(controller.beginPan(7, { x: 20, y: 30 })).toBe(true);
    controller.updatePan(7, { x: 50, y: 15 });
    controller.updatePan(7, { x: 60, y: 20 });

    expect(controller.getSnapshot()).toMatchObject({
      viewport: { pan: { x: 140, y: 50 }, zoom: 1 },
      panning: true,
    });
    expect(pending.size).toBe(1);
    expect(present).not.toHaveBeenCalled();

    flush();
    expect(present).toHaveBeenLastCalledWith(controller.getSnapshot());
  });

  it("keeps the world point under the pointer fixed while wheel zooming", () => {
    const { controller } = createHarness();
    const anchor = { x: 420, y: 260 };
    const before = screenToWorld(anchor, controller.getSnapshot().viewport);

    controller.wheelZoom(anchor, -100);

    const after = controller.getSnapshot().viewport;
    expect(after.zoom).toBe(1.05);
    expect(worldToScreen(before, after)).toEqual(anchor);
  });

  it("clamps zoom to the retained minimum and maximum", () => {
    const { controller } = createHarness();

    for (let index = 0; index < 100; index += 1) controller.wheelZoom({ x: 0, y: 0 }, 100);
    expect(controller.getSnapshot().viewport.zoom).toBe(0.5);

    for (let index = 0; index < 100; index += 1) controller.wheelZoom({ x: 0, y: 0 }, -100);
    expect(controller.getSnapshot().viewport.zoom).toBe(2.5);
  });

  it("ignores stale pointers and restores the starting camera when a pan is cancelled", () => {
    const { controller } = createHarness();
    const initial = controller.getSnapshot().viewport;

    controller.beginPan(3, { x: 0, y: 0 });
    controller.updatePan(4, { x: 200, y: 100 });
    expect(controller.getSnapshot().viewport).toBe(initial);
    controller.updatePan(3, { x: 20, y: 10 });
    controller.cancelPan(3);

    expect(controller.getSnapshot()).toEqual({ viewport: initial, panning: false });
  });
});
