// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createViewport } from "../../canvas/geometry/viewportMath";
import { COMMAND_TEST_IDS as ids } from "../../domain/commands/commandTestSupport";
import { createCanvasInteractionController } from "../interactions/canvasInteractionController";
import type { MoveCommit } from "../interactions/canvasInteractionTypes";
import {
  createWorkspaceTestStore,
  FakePersistenceScheduler,
  loadTestWorkspace,
  savedDocument,
} from "./workspaceTestSupport";

function setup() {
  const scheduler = new FakePersistenceScheduler();
  const saveDocument = vi.fn(async () => savedDocument(5));
  const store = createWorkspaceTestStore({ databaseClient: { saveDocument }, scheduler });
  loadTestWorkspace(store);
  const before = store.getState().documentWorkspace.document!;
  const commitMove = vi.fn((operation: MoveCommit) =>
    store.workspace.dispatchCommand({
      type: "document.elements.update-geometry",
      payload: {
        canvasId: ids.canvasA,
        updates: operation.targets.map((target) => ({
          elementId: target.id,
          from: target.from,
          to: target.to,
        })),
      },
    }),
  );
  // Test-only completion wiring for generic geometry. No production renderer/placement policy yet.
  const controller = createCanvasInteractionController({
    canvasKey: ids.canvasA,
    viewport: createViewport({ x: 0, y: 0 }, 1, { width: 1000, height: 800 }),
    commitPort: { commitMove, commitResize: vi.fn(), commitLayerOrder: vi.fn() },
  });
  const begin = () =>
    controller.beginMove({
      pointerId: 1,
      screen: { x: 100, y: 100 },
      primaryId: ids.elementA,
      targets: [ids.elementA, ids.elementB].map((id) => ({
        id,
        geometry: before.elements[id].geometry,
        locked: false,
        movable: true,
        resizable: true,
      })),
      snapTargets: [],
    });
  return { scheduler, saveDocument, store, before, controller, commitMove, begin };
}

describe("group geometry workspace integration", () => {
  it("keeps pointer frames outside document/history/persistence, then saves one completed transaction", async () => {
    const setupResult = setup();
    const { begin, controller, store, before, scheduler, commitMove, saveDocument } = setupResult;
    begin();
    const stringify = vi.spyOn(JSON, "stringify");
    for (let frame = 1; frame <= 100; frame++) {
      controller.updatePointer({
        pointerId: 1,
        screen: { x: 100 + frame, y: 100 + frame },
        snapping: false,
      });
    }
    expect(stringify).not.toHaveBeenCalled();
    stringify.mockRestore();
    expect(store.getState().documentWorkspace.document).toBe(before);
    expect(store.getState().documentWorkspace.history.past).toHaveLength(0);
    expect(scheduler.size).toBe(0);
    expect(commitMove).not.toHaveBeenCalled();
    expect(saveDocument).not.toHaveBeenCalled();
    controller.completePointer({ pointerId: 1, screen: { x: 200, y: 200 }, snapping: false });
    expect(commitMove).toHaveBeenCalledTimes(1);
    expect(store.getState().documentWorkspace.history.past).toHaveLength(1);
    expect(store.getState().documentWorkspace.localChangeSequence).toBe(1);
    expect(scheduler.size).toBe(1);
    await store.workspace.flushSave();
    expect(saveDocument).toHaveBeenCalledTimes(1);
    expect(store.getState().documentWorkspace.persistedChangeSequence).toBe(1);
    controller.dispose();
  });
  it("undo/redo restores the whole group together", () => {
    const { begin, controller, store, before } = setup();
    begin();
    controller.completePointer({ pointerId: 1, screen: { x: 200, y: 200 }, snapping: false });
    const after = store.getState().documentWorkspace.document;
    expect(store.workspace.undo().ok).toBe(true);
    expect(store.getState().documentWorkspace.document).toEqual(before);
    expect(store.workspace.redo().ok).toBe(true);
    expect(store.getState().documentWorkspace.document).toEqual(after);
    controller.dispose();
  });
  it("cancellation produces no transaction or scheduled save", () => {
    const { begin, controller, store, before, scheduler, commitMove } = setup();
    begin();
    controller.updatePointer({ pointerId: 1, screen: { x: 200, y: 200 }, snapping: false });
    controller.cancelPointer(1);
    expect(store.getState().documentWorkspace.document).toBe(before);
    expect(scheduler.size).toBe(0);
    expect(commitMove).not.toHaveBeenCalled();
    controller.dispose();
  });
});
