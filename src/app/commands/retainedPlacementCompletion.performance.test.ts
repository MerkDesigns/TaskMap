// @vitest-environment node
import { expect, it, vi } from "vitest";
import {
  placementCommand,
  placementIds as ids,
  placementInput,
  placementSetup,
} from "./retainedPlacementTestSupport";
import { placeRetainedElementsCommand } from "./retainedPlacementCommand";
import { createCanvasInteractionController } from "../interactions/canvasInteractionController";
import type { MoveCommit } from "../interactions/canvasInteractionTypes";
import { createViewport } from "../../canvas/geometry/viewportMath";
import { TEST_IDS } from "../../elements/cardContainerTestFixtures";

it.each([false, true])("keeps 100 placement previews transient (cancel=%s)", async (cancel) => {
  const input = placementInput();
  input.elements[ids.card].data.placement = null;
  const { store, scheduler, saveDocument } = placementSetup(input);
  const before = store.getState().documentWorkspace;
  const captured = placementCommand(before.document!);
  const commitMove = vi.fn((operation: MoveCommit) => {
    const to = operation.targets.find(({ id }) => id === ids.card)!.to;
    captured.payload.updates[0].to = { ...captured.payload.updates[0].from, x: to.x, y: to.y };
    return store.workspace.dispatchCommand(captured);
  });
  const controller = createCanvasInteractionController({
    canvasKey: TEST_IDS.canvasA,
    viewport: createViewport({ x: 0, y: 0 }, 1, { width: 1000, height: 800 }),
    commitPort: { commitMove, commitResize: vi.fn(), commitLayerOrder: vi.fn() },
  });
  const apply = vi.spyOn(placeRetainedElementsCommand, "apply");
  const stringify = vi.spyOn(JSON, "stringify");
  try {
    controller.beginMove({
      pointerId: 1,
      screen: { x: 0, y: 0 },
      primaryId: ids.card,
      targets: [
        {
          id: ids.card,
          geometry: { ...before.document!.elements[ids.card].geometry, width: 77, height: 33 },
          movable: true,
          resizable: false,
          locked: false,
        },
      ],
      snapTargets: [],
      completionBehavior: "place",
    });
    for (let frame = 1; frame <= 100; frame++) {
      controller.updatePointer({ pointerId: 1, screen: { x: frame, y: frame }, snapping: false });
    }
    expect(store.getState().documentWorkspace).toBe(before);
    expect(apply).not.toHaveBeenCalled();
    expect(commitMove).not.toHaveBeenCalled();
    expect(scheduler.size).toBe(0);
    expect(stringify).not.toHaveBeenCalled();
    if (cancel) {
      controller.cancelPointer(1);
      expect(store.getState().documentWorkspace).toBe(before);
      expect(apply).not.toHaveBeenCalled();
      expect(scheduler.size).toBe(0);
    } else {
      controller.completePointer({ pointerId: 1, screen: { x: 100, y: 100 }, snapping: false });
      expect(commitMove.mock.results[0].value).toMatchObject({ ok: true, changed: true });
      expect(apply).toHaveBeenCalledTimes(1);
      expect(store.getState().documentWorkspace.history.past).toHaveLength(1);
      expect(store.getState().documentWorkspace.document!.elements[ids.card].geometry).toEqual({
        ...before.document!.elements[ids.card].geometry,
        x: 400,
        y: 120,
      });
      expect(
        store.getState().documentWorkspace.document!.elements[ids.card].data.placement,
      ).toEqual({ containerId: ids.target, order: 0 });
      expect(scheduler.size).toBe(1);
    }
    expect(stringify).not.toHaveBeenCalled();
  } finally {
    vi.restoreAllMocks();
    controller.dispose();
  }
  await store.workspace.flushSave();
  expect(saveDocument).toHaveBeenCalledTimes(cancel ? 0 : 1);
  store.disposeWorkspace();
});

it("reorders a 1000-sibling list in one localized non-serialized transaction", () => {
  const input = placementInput();
  for (let index = 0; index < 1000; index++) {
    const id = `element-00000000-0000-4000-8000-${String(index + 100).padStart(12, "0")}`;
    input.elements[id] = {
      ...input.elements[ids.card],
      id,
      data: {
        ...input.elements[ids.card].data,
        placement: { containerId: ids.target, order: index + 8 },
      },
    };
    input.canvases[TEST_IDS.canvasA].elementOrder.push(id);
  }
  const { store, scheduler } = placementSetup(input);
  const before = store.getState().documentWorkspace.document!;
  const command = placementCommand(before);
  const stringify = vi.spyOn(JSON, "stringify");
  try {
    expect(store.workspace.dispatchCommand(command)).toMatchObject({ ok: true, changed: true });
    expect(stringify).not.toHaveBeenCalled();
    const after = store.getState().documentWorkspace;
    expect(after.history.past).toHaveLength(1);
    expect(
      after.history.past[0].patches.every(
        ({ path }) => path[0] === "elements" && path[2] === "data",
      ),
    ).toBe(true);
    expect(after.document!.canvases).toBe(before.canvases);
    expect(after.document!.mediaReferences).toBe(before.mediaReferences);
    expect(scheduler.size).toBe(1);
    const orders = Object.values(after.document!.elements)
      .flatMap(({ data }) => {
        const placement = data.placement as { containerId: string; order: number } | null;
        return placement?.containerId === ids.target ? [placement.order] : [];
      })
      .sort((a, b) => a - b);
    expect(orders).toEqual(Array.from({ length: 1002 }, (_, index) => index));
    expect(store.workspace.undo().ok).toBe(true);
    expect(store.getState().documentWorkspace.document).toEqual(before);
  } finally {
    vi.restoreAllMocks();
    store.disposeWorkspace();
  }
});
