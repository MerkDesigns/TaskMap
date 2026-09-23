// @vitest-environment node
import { expect, it, vi } from "vitest";
import { geometryIds as ids, geometryInput, geometrySetup } from "./retainedGeometryTestSupport";
import { TEST_IDS } from "../../elements/cardContainerTestFixtures";
import { editRetainedContentCommand } from "./retainedContentCommand";
import { reorderRetainedLayersCommand } from "./retainedLayerCommands";
import { createCanvasInteractionController } from "../interactions/canvasInteractionController";
import { createViewport } from "../../canvas/geometry/viewportMath";
import type { LayerOrderCommit } from "../interactions/canvasInteractionTypes";

it("keeps content/layers off 100 pan/zoom frames and combines completed actions through one save loop", async () => {
  const { store, scheduler, saveDocument } = geometrySetup();
  const before = store.getState().documentWorkspace;
  const text = {
    type: "document.elements.edit-content",
    payload: {
      canvasId: TEST_IDS.canvasA,
      updates: [
        {
          elementId: ids.card,
          type: "text-card",
          from: { text: before.document!.elements[ids.card].data.text },
          to: { text: "Completed edit" },
        },
      ],
    },
  };
  const commitLayerOrder = vi.fn(({ selectedIds, direction }: LayerOrderCommit) =>
    store.workspace.dispatchCommand({
      type: "document.elements.reorder-layers",
      payload: {
        canvasId: TEST_IDS.canvasA,
        elementIds: selectedIds,
        direction,
        expectedRootOrder: [ids.container, ids.block, ids.mindmap],
      },
    }),
  );
  const controller = createCanvasInteractionController({
    canvasKey: TEST_IDS.canvasA,
    viewport: createViewport({ x: 0, y: 0 }, 1, { width: 1000, height: 800 }),
    commitPort: { commitMove: vi.fn(), commitResize: vi.fn(), commitLayerOrder },
  });
  const contentApply = vi.spyOn(editRetainedContentCommand, "apply");
  const layerApply = vi.spyOn(reorderRetainedLayersCommand, "apply");
  const stringify = vi.spyOn(JSON, "stringify");
  try {
    controller.beginPan(1, { x: 0, y: 0 });
    for (let frame = 1; frame <= 100; frame++)
      controller.updatePointer({ pointerId: 1, screen: { x: frame, y: frame }, snapping: false });
    controller.reorder([ids.container], "front");
    expect(commitLayerOrder).not.toHaveBeenCalled();
    controller.completePointer({ pointerId: 1, screen: { x: 100, y: 100 }, snapping: false });
    for (let frame = 0; frame < 100; frame++) controller.wheelZoom({ x: 500, y: 400 }, -1);
    expect(store.getState().documentWorkspace).toBe(before);
    expect(contentApply).not.toHaveBeenCalled();
    expect(layerApply).not.toHaveBeenCalled();
    expect(scheduler.size).toBe(0);
    expect(stringify).not.toHaveBeenCalled();
    controller.reorder([ids.container], "front");
    expect(commitLayerOrder.mock.results[0].value).toMatchObject({ ok: true, changed: true });
    expect(store.workspace.dispatchCommand(text)).toMatchObject({ ok: true, changed: true });
    expect(contentApply).toHaveBeenCalledTimes(1);
    expect(layerApply).toHaveBeenCalledTimes(1);
    expect(stringify).not.toHaveBeenCalled();
    expect(store.getState().documentWorkspace.history.past).toHaveLength(2);
    expect(scheduler.size).toBe(1);
    const after = store.getState().documentWorkspace.document;
    expect(store.workspace.undo().ok).toBe(true);
    expect(store.workspace.undo().ok).toBe(true);
    expect(store.getState().documentWorkspace.document).toEqual(before.document);
    expect(store.workspace.redo().ok).toBe(true);
    expect(store.workspace.redo().ok).toBe(true);
    expect(store.getState().documentWorkspace.document).toEqual(after);
  } finally {
    vi.restoreAllMocks();
    controller.dispose();
  }
  await store.workspace.flushSave();
  expect(saveDocument).toHaveBeenCalledTimes(1);
  store.disposeWorkspace();
});

it("edits 1000 root elements and their layers with localized transactions and unchanged media/children", () => {
  const input = geometryInput();
  const extraIds: string[] = [];
  for (let index = 0; index < 1000; index++) {
    const id = `element-00000000-0000-4000-8000-${String(index + 100).padStart(12, "0")}`;
    input.elements[id] = {
      ...input.elements[ids.card],
      id,
      data: { ...input.elements[ids.card].data, placement: null },
    };
    input.canvases[TEST_IDS.canvasA].elementOrder.push(id);
    extraIds.push(id);
  }
  const { store } = geometrySetup(input);
  const before = store.getState().documentWorkspace.document!;
  const stringify = vi.spyOn(JSON, "stringify");
  try {
    expect(
      store.workspace.dispatchCommand({
        type: "document.elements.edit-content",
        payload: {
          canvasId: TEST_IDS.canvasA,
          updates: extraIds.map((id) => ({
            elementId: id,
            type: "text-card",
            from: { accent: input.elements[id].data.accent },
            to: { accent: "purple" },
          })),
        },
      }).ok,
    ).toBe(true);
    const content = store.getState().documentWorkspace;
    expect(
      content.history.past[0].patches.every(
        ({ path }) => path[0] === "elements" && path[2] === "data" && path[3] === "accent",
      ),
    ).toBe(true);
    expect(
      store.workspace.dispatchCommand({
        type: "document.elements.reorder-layers",
        payload: {
          canvasId: TEST_IDS.canvasA,
          elementIds: [...extraIds].reverse(),
          direction: "back",
          expectedRootOrder: [ids.container, ids.block, ids.mindmap, ...extraIds],
        },
      }).ok,
    ).toBe(true);
    const after = store.getState().documentWorkspace;
    expect(after.history.past).toHaveLength(2);
    expect(
      after.history.past[1].patches.every(
        ({ path }) => path[0] === "canvases" && path[2] === "elementOrder",
      ),
    ).toBe(true);
    expect(after.document!.elements).toBe(content.document!.elements);
    expect(after.document!.elements[ids.card]).toBe(before.elements[ids.card]);
    expect(after.document!.elements[ids.image]).toBe(before.elements[ids.image]);
    expect(after.document!.mediaReferences).toBe(before.mediaReferences);
    expect(stringify).not.toHaveBeenCalled();
    expect(store.workspace.undo().ok).toBe(true);
    expect(store.workspace.undo().ok).toBe(true);
    expect(store.getState().documentWorkspace.document).toEqual(before);
  } finally {
    vi.restoreAllMocks();
    store.disposeWorkspace();
  }
});
