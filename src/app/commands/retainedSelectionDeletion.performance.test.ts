// @vitest-environment node
import { expect, it, vi } from "vitest";
import { createAppStore } from "../store";
import { acceptRetainedDocument } from "../database/acceptRetainedDocument";
import { retainedDocumentCommandHandlers } from "./retainedDocumentCommandHandlers";
import { deleteRetainedSelectionCommand } from "./retainedSelectionDeletion";
import { createCardContainerInput, TEST_IDS } from "../../elements/cardContainerTestFixtures";
import { createCanvasInteractionController } from "../interactions/canvasInteractionController";
import { createViewport } from "../../canvas/geometry/viewportMath";

it("keeps deletion off camera frames and deletes 1000 children in one non-serialized transaction", () => {
  const input = createCardContainerInput();
  for (let index = 0; index < 1000; index++) {
    const id = `element-00000000-0000-4000-8000-${String(index + 100).padStart(12, "0")}`;
    input.elements[id] = {
      ...input.elements[TEST_IDS.elementB],
      id,
      data: {
        ...input.elements[TEST_IDS.elementB].data,
        placement: { containerId: TEST_IDS.elementA, order: index + 4 },
      },
    };
    input.canvases[TEST_IDS.canvasA].elementOrder.push(id);
  }
  const store = createAppStore({
    acceptDocument: acceptRetainedDocument,
    commandHandlers: retainedDocumentCommandHandlers,
  });
  expect(store.workspace.load(input, 0).ok).toBe(true);
  const before = store.getState().documentWorkspace;
  const apply = vi.spyOn(deleteRetainedSelectionCommand, "apply");
  const stringify = vi.spyOn(JSON, "stringify");
  const controller = createCanvasInteractionController({
    canvasKey: TEST_IDS.canvasA,
    viewport: createViewport({ x: 0, y: 0 }, 1, { width: 1000, height: 800 }),
    commitPort: { commitMove: vi.fn(), commitResize: vi.fn(), commitLayerOrder: vi.fn() },
  });
  try {
    controller.beginPan(1, { x: 0, y: 0 });
    for (let frame = 1; frame <= 100; frame++)
      controller.updatePointer({ pointerId: 1, screen: { x: frame, y: frame }, snapping: false });
    controller.completePointer({ pointerId: 1, screen: { x: 100, y: 100 }, snapping: false });
    for (let frame = 0; frame < 100; frame++) controller.wheelZoom({ x: 500, y: 400 }, -1);
    expect(apply).not.toHaveBeenCalled();
    expect(store.getState().documentWorkspace).toBe(before);
    expect(
      store.workspace.dispatchCommand({
        type: "document.selection.delete",
        payload: { canvasId: TEST_IDS.canvasA, elementIds: [TEST_IDS.elementA] },
      }),
    ).toMatchObject({ ok: true, changed: true });
    expect(apply).toHaveBeenCalledTimes(1);
    expect(stringify).not.toHaveBeenCalled();
    const after = store.getState().documentWorkspace;
    expect(after.document?.elements).toEqual({});
    expect(after.history.past).toHaveLength(1);
    expect(
      after.history.past[0].patches.every(
        (patch) => patch.path[0] === "elements" || patch.path[0] === "canvases",
      ),
    ).toBe(true);
    expect(store.workspace.undo().ok).toBe(true);
    expect(store.getState().documentWorkspace.document).toEqual(before.document);
  } finally {
    vi.restoreAllMocks();
    controller.dispose();
    store.disposeWorkspace();
  }
});
