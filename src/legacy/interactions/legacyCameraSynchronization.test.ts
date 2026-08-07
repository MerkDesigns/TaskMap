// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createCanvasInteractionController } from "../../app/interactions/canvasInteractionController";
import { createViewport } from "../../canvas/geometry/viewportMath";
import { createLegacyCameraSynchronization } from "./legacyCameraSynchronization";

function setup() {
  const callbacks = new Map<number, () => void>();
  let handle = 0;
  const writeLegacyCamera = vi.fn();
  const adoptLegacyCamera = vi.fn();
  const synchronization = createLegacyCameraSynchronization({
    initialCanvasId: "a",
    initialCamera: { pan: { x: 0, y: 0 }, zoom: 1 },
    scheduler: {
      schedule: (callback) => {
        callbacks.set(++handle, callback);
        return handle;
      },
      cancel: (cancelled) => callbacks.delete(cancelled),
    },
    writeLegacyCamera,
    adoptLegacyCamera,
  });
  const flush = () => {
    const queued = [...callbacks.values()];
    callbacks.clear();
    queued.forEach((callback) => callback());
  };
  return { synchronization, writeLegacyCamera, adoptLegacyCamera, flush, callbacks };
}

describe("legacy camera synchronization", () => {
  it("discards an A write when B replaces it and adopts B's viewport", () => {
    const { synchronization, writeLegacyCamera, adoptLegacyCamera, flush } = setup();
    synchronization.queueControllerCamera("a", { pan: { x: 20, y: 30 }, zoom: 1.5 });
    synchronization.observeLegacyCamera("b", { pan: { x: 7, y: 8 }, zoom: 2 });
    flush();
    expect(writeLegacyCamera).not.toHaveBeenCalled();
    expect(adoptLegacyCamera).toHaveBeenCalledWith("b", { pan: { x: 7, y: 8 }, zoom: 2 });
  });

  it("adopts same-ID external replacement without fighting pending controller state", () => {
    const { synchronization, writeLegacyCamera, adoptLegacyCamera, flush } = setup();
    synchronization.queueControllerCamera("a", { pan: { x: 20, y: 30 }, zoom: 1.5 });
    synchronization.observeLegacyCamera("a", { pan: { x: 0, y: 0 }, zoom: 1 });
    expect(adoptLegacyCamera).not.toHaveBeenCalled();
    flush();
    expect(writeLegacyCamera).toHaveBeenCalledOnce();
    synchronization.observeLegacyCamera("a", { pan: { x: 20, y: 30 }, zoom: 1.5 });
    expect(adoptLegacyCamera).not.toHaveBeenCalled();
    synchronization.observeLegacyCamera("a", { pan: { x: -40, y: 60 }, zoom: 0.75 });
    expect(adoptLegacyCamera).toHaveBeenCalledWith("a", {
      pan: { x: -40, y: 60 },
      zoom: 0.75,
    });
  });

  it("does not queue a legacy camera write when pan cancellation restores its start", () => {
    const { synchronization, writeLegacyCamera, flush } = setup();
    const controller = createCanvasInteractionController({
      canvasKey: "a",
      viewport: createViewport({ x: 0, y: 0 }, 1, { width: 800, height: 600 }),
      commitPort: { commitMove: vi.fn(), commitResize: vi.fn(), commitLayerOrder: vi.fn() },
      onViewportSettled: (viewport, canvasId) =>
        synchronization.queueControllerCamera(canvasId, viewport),
    });
    const starting = controller.getSnapshot().viewport;
    controller.beginPan(1, { x: 0, y: 0 });
    controller.updatePointer({ pointerId: 1, screen: { x: 80, y: 50 }, snapping: false });
    controller.cancelPointer(1);
    flush();
    expect(controller.getSnapshot().viewport).toEqual(starting);
    expect(writeLegacyCamera).not.toHaveBeenCalled();
  });
});
