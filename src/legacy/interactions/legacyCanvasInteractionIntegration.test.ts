// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createCanvasInteractionController } from "../../app/interactions/canvasInteractionController";
import { createViewport } from "../../canvas/geometry/viewportMath";
import type { TaskCanvas } from "../../types";
import { createLegacyCanvasInteractionCommitAdapter } from "./legacyCanvasInteractionCommitAdapter";
import { getLegacyInteractionElements } from "./legacyCanvasGeometry";

const initial: TaskCanvas = {
  id: "canvas",
  name: "Canvas",
  width: 2000,
  height: 1200,
  pan: { x: 0, y: 0 },
  zoom: 1,
  containers: [
    { id: "element", name: "Element", x: 100, y: 100, width: 300, height: 200, accent: "#fff" },
  ],
  textBlocks: [],
  textCards: [],
  images: [],
  mindmapConnections: [],
};

describe("legacy production interaction boundary", () => {
  it("keeps pointer frames transient and makes one undoable/autosaved commit", () => {
    let current = initial;
    const history: TaskCanvas[] = [initial];
    const autosave = vi.fn();
    const commitPort = createLegacyCanvasInteractionCommitAdapter({
      getActiveCanvas: () => current,
      commitActiveCanvas: (next) => {
        current = next;
        history.push(next);
        autosave(next);
      },
    });
    const controller = createCanvasInteractionController({
      canvasKey: current.id,
      viewport: createViewport(current.pan, current.zoom, { width: 1000, height: 800 }),
      commitPort,
    });
    const target = getLegacyInteractionElements(current)[0];
    controller.beginMove({
      pointerId: 1,
      screen: { x: 0, y: 0 },
      primaryId: target.id,
      targets: [target],
      snapTargets: [],
    });
    for (let frame = 1; frame <= 60; frame += 1) {
      controller.updatePointer({
        pointerId: 1,
        screen: { x: frame, y: frame * 2 },
        snapping: false,
      });
    }
    expect(current).toBe(initial);
    expect(history).toHaveLength(1);
    expect(autosave).not.toHaveBeenCalled();
    controller.completePointer({ pointerId: 1, screen: { x: 60, y: 120 }, snapping: false });
    expect(history).toHaveLength(2);
    expect(autosave).toHaveBeenCalledOnce();
    expect(current.containers[0]).toMatchObject({ x: 160, y: 220 });
    current = history[0];
    expect(current.containers[0]).toMatchObject({ x: 100, y: 100 });
  });

  it("makes cancel and no-op completion invisible to history and autosave", () => {
    let current = initial;
    const commitActiveCanvas = vi.fn((next: TaskCanvas) => {
      current = next;
    });
    const controller = createCanvasInteractionController({
      canvasKey: current.id,
      viewport: createViewport(current.pan, current.zoom, { width: 1000, height: 800 }),
      commitPort: createLegacyCanvasInteractionCommitAdapter({
        getActiveCanvas: () => current,
        commitActiveCanvas,
      }),
    });
    const target = getLegacyInteractionElements(current)[0];
    controller.beginMove({
      pointerId: 1,
      screen: { x: 0, y: 0 },
      primaryId: target.id,
      targets: [target],
      snapTargets: [],
    });
    controller.updatePointer({ pointerId: 1, screen: { x: 40, y: 50 }, snapping: false });
    controller.cancelPointer(1);
    controller.beginMove({
      pointerId: 2,
      screen: { x: 0, y: 0 },
      primaryId: target.id,
      targets: [target],
      snapTargets: [],
    });
    controller.completePointer({ pointerId: 2, screen: { x: 0, y: 0 }, snapping: false });
    expect(commitActiveCanvas).not.toHaveBeenCalled();
    expect(current).toBe(initial);
  });

  it("moves only eligible top-level targets when selection also contains a contained card", () => {
    let current: TaskCanvas = {
      ...initial,
      textCards: [
        {
          id: "inside",
          text: "Inside",
          x: 0,
          y: 0,
          accent: "#fff",
          containerId: "element",
          order: 0,
        },
      ],
    };
    const controller = createCanvasInteractionController({
      canvasKey: current.id,
      viewport: createViewport(current.pan, current.zoom, { width: 1000, height: 800 }),
      commitPort: createLegacyCanvasInteractionCommitAdapter({
        getActiveCanvas: () => current,
        commitActiveCanvas: (next) => {
          current = next;
        },
      }),
    });
    const selectedIds = ["element", "inside"];
    const targets = selectedIds.flatMap((id) => {
      const target = getLegacyInteractionElements(current).find((element) => element.id === id);
      return target ? [target] : [];
    });
    controller.beginMove({
      pointerId: 1,
      screen: { x: 0, y: 0 },
      primaryId: "element",
      targets,
      snapTargets: [],
    });
    controller.completePointer({ pointerId: 1, screen: { x: 50, y: 60 }, snapping: false });
    expect(current.containers[0]).toMatchObject({ x: 150, y: 160 });
    expect(current.textCards[0]).toMatchObject({ x: 0, y: 0, containerId: "element" });
  });
});
