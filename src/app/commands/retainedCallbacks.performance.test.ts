// @vitest-environment node
import { expect, it, vi } from "vitest";
import { callbackSetup } from "./retainedCallbackTestSupport";
import { geometryIds as ids } from "./retainedGeometryTestSupport";
import { TEST_IDS } from "../../elements/cardContainerTestFixtures";
import { createCanvasInteractionController } from "../interactions/canvasInteractionController";
import { createViewport } from "../../canvas/geometry/viewportMath";
import type { MoveCommit } from "../interactions/canvasInteractionTypes";
import { createRetainedActionCallbacks } from "./createRetainedActionCallbacks";

it.each([false, true])(
  "binds real controller completion with zero persistent work during 100 previews (cancel=%s)",
  async (cancel) => {
    const setup = await callbackSetup();
    const before = setup.store.getState().documentWorkspace;
    const captured = setup.actions.captureMove(ids.card, [ids.card])!;
    const commit = vi.fn((operation: MoveCommit) => captured.complete({ operation }));
    const controller = createCanvasInteractionController({
      canvasKey: TEST_IDS.canvasA,
      viewport: createViewport({ x: 0, y: 0 }, 1, { width: 1000, height: 800 }),
      commitPort: { commitMove: commit, commitResize: vi.fn(), commitLayerOrder: vi.fn() },
    });
    const dispatch = vi.spyOn(setup.store.workspace, "dispatchCommand");
    const lifecycle = vi.spyOn(setup.controller, "getSnapshot");
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
            locked: false,
            movable: true,
            resizable: false,
          },
        ],
        snapTargets: [],
        completionBehavior: "translate",
      });
      for (let frame = 1; frame <= 100; frame++)
        controller.updatePointer({ pointerId: 1, screen: { x: frame, y: frame }, snapping: false });
      expect(setup.store.getState().documentWorkspace).toBe(before);
      expect(dispatch).not.toHaveBeenCalled();
      expect(lifecycle).not.toHaveBeenCalled();
      expect(stringify).not.toHaveBeenCalled();
      expect(setup.scheduler.size).toBe(0);
      if (cancel) {
        controller.cancelPointer(1);
        captured.cancel();
      } else
        controller.completePointer({ pointerId: 1, screen: { x: 100, y: 100 }, snapping: false });
      expect(dispatch).toHaveBeenCalledTimes(cancel ? 0 : 1);
      expect(setup.store.getState().documentWorkspace.history.past).toHaveLength(cancel ? 0 : 1);
      expect(stringify).not.toHaveBeenCalled();
      if (!cancel) expect(commit.mock.results[0].value).toEqual({ ok: true, changed: true });
    } finally {
      vi.restoreAllMocks();
      controller.dispose();
    }
    await setup.store.workspace.flushSave();
    expect(setup.client.saveDocument).toHaveBeenCalledTimes(cancel ? 0 : 1);
    await setup.dispose();
  },
);

it("uses one subscription pair and bounded supersession for repeated captures; disposal unsubscribes", async () => {
  const setup = await callbackSetup();
  setup.actions.dispose();
  const originalStoreSubscribe = setup.store.subscribe;
  const originalSessionSubscribe = setup.controller.subscribe;
  const stopStore = vi.fn();
  const stopSession = vi.fn();
  const storeSubscribe = vi.spyOn(setup.store, "subscribe").mockImplementation((listener) => {
    const unsubscribe = originalStoreSubscribe(listener);
    return () => {
      stopStore();
      unsubscribe();
    };
  });
  const sessionSubscribe = vi
    .spyOn(setup.controller, "subscribe")
    .mockImplementation((listener) => {
      const unsubscribe = originalSessionSubscribe(listener);
      return () => {
        stopSession();
        unsubscribe();
      };
    });
  const actions = createRetainedActionCallbacks(setup.controller);
  const initial = actions.captureDelete([ids.card])!;
  for (let index = 0; index < 1000; index++) actions.captureDelete([ids.card]);
  expect(storeSubscribe).toHaveBeenCalledTimes(1);
  expect(sessionSubscribe).toHaveBeenCalledTimes(1);
  expect(initial.complete()).toEqual({ ok: false, code: "expired-action" });
  actions.dispose();
  actions.dispose();
  expect(stopStore).toHaveBeenCalledTimes(1);
  expect(stopSession).toHaveBeenCalledTimes(1);
  expect(actions.captureDelete([ids.card])).toBeNull();
  expect(setup.scheduler.size).toBe(0);
  vi.restoreAllMocks();
  await setup.dispose();
});
