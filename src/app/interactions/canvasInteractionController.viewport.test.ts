// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createViewport, screenToWorld } from "../../canvas/geometry/viewportMath";
import { createCanvasInteractionController } from "./canvasInteractionController";
import type { CanvasInteractionCommitPort, InteractionElement } from "./canvasInteractionTypes";

const viewport = createViewport({ x: 100, y: 50 }, 2, { width: 800, height: 600 });

function commitPort(): CanvasInteractionCommitPort {
  return {
    commitMove: vi.fn(),
    commitResize: vi.fn(),
    commitLayerOrder: vi.fn(),
  };
}

function candidate(id: string, x: number, y: number, locked = false): InteractionElement {
  return {
    id,
    geometry: { x, y, width: 50, height: 40 },
    locked,
    movable: true,
    resizable: true,
  };
}

describe("canvas viewport controller", () => {
  it("publishes its initial state and subscriptions", () => {
    const controller = createCanvasInteractionController({
      canvasKey: "a",
      viewport,
      commitPort: commitPort(),
    });
    const listener = vi.fn();
    const unsubscribe = controller.subscribe(listener);
    expect(controller.getSnapshot()).toMatchObject({
      canvasKey: "a",
      viewport,
      activeInteraction: null,
      selectedIds: [],
    });
    controller.resizeViewport({ width: 900, height: 700 });
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
    controller.resizeViewport({ width: 1000, height: 800 });
    expect(listener).toHaveBeenCalledOnce();
  });

  it("owns pan, ignores stale pointers, settles once, and creates no commit", () => {
    const commits = commitPort();
    const settled = vi.fn();
    const controller = createCanvasInteractionController({
      canvasKey: "a",
      viewport,
      commitPort: commits,
      onViewportSettled: settled,
    });
    expect(controller.beginPan(7, { x: 10, y: 20 })).toBe(true);
    expect(
      controller.beginSelection({
        pointerId: 8,
        screen: { x: 0, y: 0 },
        candidates: [],
        additive: false,
      }),
    ).toBe(false);
    controller.updatePointer({ pointerId: 8, screen: { x: 500, y: 500 }, snapping: false });
    expect(controller.getSnapshot().viewport.pan).toEqual({ x: 100, y: 50 });
    controller.updatePointer({ pointerId: 7, screen: { x: 40, y: 5 }, snapping: false });
    expect(controller.getSnapshot().viewport.pan).toEqual({ x: 130, y: 35 });
    controller.completePointer({ pointerId: 7, screen: { x: 50, y: 10 }, snapping: false });
    expect(controller.getSnapshot().viewport.pan).toEqual({ x: 140, y: 40 });
    expect(settled).toHaveBeenCalledOnce();
    expect(commits.commitMove).not.toHaveBeenCalled();
    expect(commits.commitResize).not.toHaveBeenCalled();
  });

  it("coalesces raw pan samples to one publication per animation frame and flushes pointer-up", () => {
    const frames = controlledPanFrames();
    const settled = vi.fn();
    const controller = createCanvasInteractionController({
      canvasKey: "a",
      viewport,
      commitPort: commitPort(),
      panFrameScheduler: frames.scheduler,
      onViewportSettled: settled,
    });
    const listener = vi.fn();
    controller.subscribe(listener);

    controller.beginPan(7, { x: 10, y: 20 });
    listener.mockClear();
    for (let sample = 1; sample <= 120; sample += 1) {
      controller.updatePointer({
        pointerId: 7,
        screen: { x: 10 + sample, y: 20 - sample },
        snapping: false,
      });
    }

    expect(frames.pending()).toBe(1);
    expect(listener).not.toHaveBeenCalled();
    expect(controller.getSnapshot().viewport.pan).toEqual({ x: 100, y: 50 });

    frames.flush();
    expect(listener).toHaveBeenCalledOnce();
    expect(controller.getSnapshot().viewport.pan).toEqual({ x: 220, y: -70 });

    controller.updatePointer({ pointerId: 7, screen: { x: 132, y: -102 }, snapping: false });
    controller.completePointer({ pointerId: 7, screen: { x: 135, y: -105 }, snapping: false });
    expect(frames.pending()).toBe(0);
    expect(controller.getSnapshot().viewport.pan).toEqual({ x: 225, y: -75 });
    expect(controller.getSnapshot().activeInteraction).toBeNull();
    expect(settled).toHaveBeenCalledWith(controller.getSnapshot().viewport, "a");
  });

  it("cancels without settling and isolates replacement canvases", () => {
    const settled = vi.fn();
    const commits = commitPort();
    const controller = createCanvasInteractionController({
      canvasKey: "a",
      viewport,
      commitPort: commits,
      onViewportSettled: settled,
    });
    const startingViewport = controller.getSnapshot().viewport;
    controller.beginPan(1, { x: 0, y: 0 });
    controller.updatePointer({ pointerId: 1, screen: { x: 10, y: 10 }, snapping: false });
    expect(controller.getSnapshot().viewport).not.toEqual(startingViewport);
    controller.cancelPointer(2);
    expect(controller.getSnapshot()).toMatchObject({
      viewport: { pan: { x: 110, y: 60 } },
      activeInteraction: { kind: "pan", pointerId: 1 },
    });
    controller.cancelPointer(1);
    expect(controller.getSnapshot().viewport).toEqual(startingViewport);
    expect(controller.getSnapshot().activeInteraction).toBeNull();
    expect(settled).not.toHaveBeenCalled();
    expect(commits.commitMove).not.toHaveBeenCalled();
    expect(commits.commitResize).not.toHaveBeenCalled();
    expect(commits.commitLayerOrder).not.toHaveBeenCalled();
    controller.select("old", false);
    controller.replaceCanvas("b", createViewport({ x: 5, y: 6 }, 1, { width: 200, height: 100 }));
    expect(controller.getSnapshot()).toMatchObject({
      canvasKey: "b",
      selectedIds: [],
      activeInteraction: null,
    });
  });

  it("anchors wheel zoom, resets at center, and stops publishing after disposal", () => {
    const settled = vi.fn();
    const controller = createCanvasInteractionController({
      canvasKey: "a",
      viewport,
      commitPort: commitPort(),
      onViewportSettled: settled,
    });
    const anchor = { x: 300, y: 250 };
    const world = screenToWorld(anchor, controller.getSnapshot().viewport);
    controller.wheelZoom(anchor, -100);
    expect(screenToWorld(anchor, controller.getSnapshot().viewport)).toEqual(world);
    controller.resetZoom();
    expect(controller.getSnapshot().viewport.zoom).toBe(1);
    const beforeDispose = controller.getSnapshot();
    controller.dispose();
    controller.wheelZoom(anchor, -100);
    expect(controller.getSnapshot()).toBe(beforeDispose);
    expect(settled).toHaveBeenCalledTimes(2);
  });
});

function controlledPanFrames() {
  const callbacks = new Map<number, () => void>();
  let nextHandle = 1;
  return {
    scheduler: {
      schedule(callback: () => void) {
        const handle = nextHandle++;
        callbacks.set(handle, callback);
        return handle;
      },
      cancel(handle: number) {
        callbacks.delete(handle);
      },
    },
    pending: () => callbacks.size,
    flush() {
      const pending = [...callbacks.values()];
      callbacks.clear();
      pending.forEach((callback) => callback());
    },
  };
}

describe("selection controller", () => {
  it("selects, shift-adds rather than toggles, and clears", () => {
    const controller = createCanvasInteractionController({
      canvasKey: "a",
      viewport,
      commitPort: commitPort(),
    });
    controller.select("a", false);
    controller.select("b", true);
    controller.select("a", true);
    expect(controller.getSnapshot().selectedIds).toEqual(["a", "b"]);
    controller.clearSelection();
    expect(controller.getSnapshot().selectedIds).toEqual([]);
  });

  it("box-selects partial intersections including locked elements", () => {
    const controller = createCanvasInteractionController({
      canvasKey: "a",
      viewport: createViewport({ x: 0, y: 0 }, 1, { width: 800, height: 600 }),
      commitPort: commitPort(),
    });
    controller.beginSelection({
      pointerId: 1,
      screen: { x: 0, y: 0 },
      candidates: [
        candidate("partial", 90, 90),
        candidate("locked", 10, 10, true),
        candidate("out", 101, 0),
      ],
      additive: false,
    });
    controller.updatePointer({ pointerId: 1, screen: { x: 100, y: 100 }, snapping: false });
    expect(controller.getSnapshot().selectionRectangle).toEqual({
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    controller.completePointer({ pointerId: 1, screen: { x: 100, y: 100 }, snapping: false });
    expect(controller.getSnapshot().selectedIds).toEqual(["partial", "locked"]);
  });

  it("uses the four-world-unit tiny-box clearing rule and additive preservation", () => {
    const controller = createCanvasInteractionController({
      canvasKey: "a",
      viewport: createViewport({ x: 0, y: 0 }, 2, { width: 800, height: 600 }),
      commitPort: commitPort(),
    });
    controller.select("existing", false);
    controller.beginSelection({
      pointerId: 1,
      screen: { x: 0, y: 0 },
      candidates: [],
      additive: true,
    });
    controller.completePointer({ pointerId: 1, screen: { x: 6, y: 6 }, snapping: false });
    expect(controller.getSnapshot().selectedIds).toEqual(["existing"]);
    controller.beginSelection({
      pointerId: 2,
      screen: { x: 0, y: 0 },
      candidates: [],
      additive: false,
    });
    controller.completePointer({ pointerId: 2, screen: { x: 6, y: 6 }, snapping: false });
    expect(controller.getSnapshot().selectedIds).toEqual([]);
  });
});
