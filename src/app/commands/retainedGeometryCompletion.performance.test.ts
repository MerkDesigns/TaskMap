// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  geometryIds as ids,
  geometryInput,
  geometrySetup,
  geometryLock,
} from "./retainedGeometryTestSupport";
import { TEST_IDS } from "../../elements/cardContainerTestFixtures";
import type { ElementId } from "../../domain/ids/entityIds";
import { createCanvasInteractionController } from "../interactions/canvasInteractionController";
import type { MoveCommit, ResizeCommit } from "../interactions/canvasInteractionTypes";
import { createViewport } from "../../canvas/geometry/viewportMath";

function setup() {
  const input = geometryLock(geometryInput(), ids.image);
  input.elements[ids.card].data.placement = null;
  input.elements[ids.image].data.placement = null;
  const context = geometrySetup(input);
  const { store } = context;
  const before = store.getState().documentWorkspace.document!;
  // Test-only binding: capture canonical geometry, never commit content-derived card dimensions.
  const commitMove = vi.fn((operation: MoveCommit) =>
    store.workspace.dispatchCommand({
      type: "document.elements.update-geometry",
      payload: {
        canvasId: TEST_IDS.canvasA,
        updates: operation.targets.map((target) => {
          const from = before.elements[target.id as ElementId].geometry;
          return { elementId: target.id, from, to: { ...from, x: target.to.x, y: target.to.y } };
        }),
      },
    }),
  );
  const commitResize = vi.fn((operation: ResizeCommit) => {
    const from = before.elements[operation.id as ElementId].geometry;
    return store.workspace.dispatchCommand({
      type: "document.elements.update-geometry",
      payload: {
        canvasId: TEST_IDS.canvasA,
        updates: [
          {
            elementId: operation.id,
            from,
            to: { ...from, width: operation.to.width, height: operation.to.height },
          },
        ],
      },
    });
  });
  const controller = createCanvasInteractionController({
    canvasKey: TEST_IDS.canvasA,
    viewport: createViewport({ x: 0, y: 0 }, 1, { width: 1000, height: 800 }),
    commitPort: { commitMove, commitResize, commitLayerOrder: vi.fn() },
  });
  const begin = () =>
    controller.beginMove({
      pointerId: 1,
      screen: { x: 0, y: 0 },
      primaryId: ids.container,
      targets: [ids.container, ids.card, ids.image].map((id) => ({
        id,
        geometry:
          id === ids.card
            ? { ...before.elements[id].geometry, width: 77, height: 33 }
            : before.elements[id].geometry,
        locked: id === ids.image,
        movable: true,
        resizable: id !== ids.card,
      })),
      snapTargets: [],
      completionBehavior: "translate",
    });
  return { ...context, before, controller, commitMove, commitResize, begin };
}

describe("retained geometry completion boundaries", () => {
  it("keeps 100 preview frames transient, excludes initial locks and saves one canonical group edit", async () => {
    const { store, before, controller, begin, commitMove, scheduler, saveDocument } = setup();
    begin();
    const stringify = vi.spyOn(JSON, "stringify");
    try {
      for (let frame = 1; frame <= 100; frame++)
        controller.updatePointer({ pointerId: 1, screen: { x: frame, y: frame }, snapping: false });
      expect(store.getState().documentWorkspace.document).toBe(before);
      expect(store.getState().documentWorkspace.history.past).toHaveLength(0);
      expect(scheduler.size).toBe(0);
      expect(commitMove).not.toHaveBeenCalled();
      expect(stringify).not.toHaveBeenCalled();
      controller.completePointer({ pointerId: 1, screen: { x: 100, y: 100 }, snapping: false });
      expect(commitMove).toHaveBeenCalledTimes(1);
      expect(commitMove.mock.results[0].value).toMatchObject({ ok: true, changed: true });
      expect(stringify).not.toHaveBeenCalled();
    } finally {
      stringify.mockRestore();
      controller.dispose();
    }
    const after = store.getState().documentWorkspace.document!;
    expect(after.elements[ids.card].geometry).toEqual({
      ...before.elements[ids.card].geometry,
      x: before.elements[ids.card].geometry.x + 100,
      y: before.elements[ids.card].geometry.y + 100,
    });
    expect(after.elements[ids.image]).toBe(before.elements[ids.image]);
    expect(store.getState().documentWorkspace.history.past).toHaveLength(1);
    expect(scheduler.size).toBe(1);
    expect(store.workspace.undo().ok).toBe(true);
    expect(store.getState().documentWorkspace.document).toEqual(before);
    expect(store.workspace.redo().ok).toBe(true);
    await store.workspace.flushSave();
    expect(saveDocument).toHaveBeenCalledTimes(1);
    store.disposeWorkspace();
  });

  it("rejects the entire completion when a previously movable target becomes locked", () => {
    const { store, controller, begin, commitMove, scheduler } = setup();
    begin();
    store.workspace.dispatchCommand({
      type: "document.extension.install",
      payload: {
        installation: {
          id: TEST_IDS.extensionB,
          extensionId: "lock",
          enabled: true,
          configuration: { enabled: true },
          target: { kind: "element", elementId: ids.card },
        },
      },
    });
    const afterLock = store.getState().documentWorkspace;
    const pending = scheduler.size;
    controller.completePointer({ pointerId: 1, screen: { x: 100, y: 100 }, snapping: false });
    expect(commitMove.mock.results[0].value).toMatchObject({ ok: false });
    expect(store.getState().documentWorkspace).toBe(afterLock);
    expect(scheduler.size).toBe(pending);
    controller.dispose();
    store.disposeWorkspace();
  });

  it("cancels without geometry history or persistence", () => {
    const { store, before, controller, begin, commitMove, scheduler } = setup();
    begin();
    controller.updatePointer({ pointerId: 1, screen: { x: 100, y: 100 }, snapping: false });
    controller.cancelPointer(1);
    expect(commitMove).not.toHaveBeenCalled();
    expect(store.getState().documentWorkspace.document).toBe(before);
    expect(scheduler.size).toBe(0);
    controller.dispose();
    store.disposeWorkspace();
  });

  it("commits one constrained resize without changing canonical position", () => {
    const { store, before, controller, commitResize } = setup();
    controller.beginResize({
      pointerId: 1,
      screen: { x: 0, y: 0 },
      target: {
        id: ids.container,
        geometry: before.elements[ids.container].geometry,
        locked: false,
        movable: true,
        resizable: true,
      },
      constraints: { minimum: { width: 80, height: 60 }, maximum: { width: 500, height: 500 } },
      snapTargets: [],
    });
    controller.updatePointer({ pointerId: 1, screen: { x: 25, y: 20 }, snapping: false });
    expect(commitResize).not.toHaveBeenCalled();
    controller.completePointer({ pointerId: 1, screen: { x: 25, y: 20 }, snapping: false });
    expect(commitResize.mock.results[0].value).toMatchObject({ ok: true, changed: true });
    expect(store.getState().documentWorkspace.document!.elements[ids.container].geometry).toEqual({
      ...before.elements[ids.container].geometry,
      width: 265,
      height: 140,
    });
    expect(store.getState().documentWorkspace.history.past).toHaveLength(1);
    controller.dispose();
    store.disposeWorkspace();
  });
});
