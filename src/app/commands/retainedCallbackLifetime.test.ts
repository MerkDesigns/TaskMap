// @vitest-environment node
import { expect, it, vi } from "vitest";
import { callbackSetup } from "./retainedCallbackTestSupport";
import { geometryIds as ids } from "./retainedGeometryTestSupport";
import { TEST_IDS } from "../../elements/cardContainerTestFixtures";
import { captureRetainedTextEdit } from "./retainedEditorCallbacks";

it.each([
  "clear-reload",
  "replace-same-ids",
  "canvas-away-back",
  "clear-callbacks",
  "dispose-callbacks",
])("expires all captured actions after %s", async (reason) => {
  const setup = await callbackSetup();
  const { store, actions } = setup;
  const document = store.getState().documentWorkspace.document!;
  const move = actions.captureMove(ids.card, [ids.card])!;
  const operation = setup.move();
  const edit = captureRetainedTextEdit(actions, ids.card, "text")!;
  const layer = actions.captureLayers([ids.container], "front")!;
  const remove = actions.captureDelete([ids.image])!;
  if (reason === "clear-reload") {
    store.workspace.clear();
    store.workspace.load(document, 4);
  }
  if (reason === "replace-same-ids") store.workspace.load(document, 4);
  if (reason === "canvas-away-back")
    for (const canvasId of [TEST_IDS.canvasB, TEST_IDS.canvasA]) {
      expect(
        store.workspace.dispatchCommand({
          type: "document.canvas.set-active",
          payload: { canvasId },
        }).ok,
      ).toBe(true);
    }
  if (reason === "clear-callbacks") actions.clear();
  if (reason === "dispose-callbacks") actions.dispose();
  const before = store.getState().documentWorkspace;
  const dispatch = vi.spyOn(store.workspace, "dispatchCommand");
  expect(move.complete({ operation })).toEqual({ ok: false, code: "expired-action" });
  expect(edit.complete("Old edit")).toEqual({ ok: false, code: "expired-action" });
  expect(layer.complete()).toEqual({ ok: false, code: "expired-action" });
  expect(remove.complete()).toEqual({ ok: false, code: "expired-action" });
  expect(dispatch).not.toHaveBeenCalled();
  expect(store.getState().documentWorkspace).toBe(before);
  dispatch.mockRestore();
  await setup.dispose();
});

it("expires callbacks synchronously when lock begins, and they stay expired after unlock", async () => {
  const setup = await callbackSetup();
  const edit = captureRetainedTextEdit(setup.actions, ids.card, "text")!;
  const locking = setup.controller.lock();
  expect(edit.complete("Late edit")).toEqual({ ok: false, code: "expired-action" });
  expect(await locking).toMatchObject({ ok: true });
  expect(setup.actions.captureDelete([ids.card])).toBeNull();
  expect((await setup.controller.unlock("test-only-password")).ok).toBe(true);
  expect(edit.complete("Still late")).toEqual({ ok: false, code: "expired-action" });
  expect(captureRetainedTextEdit(setup.actions, ids.card, "text")!.complete("Fresh")).toEqual({
    ok: true,
    changed: true,
  });
  await setup.dispose();
});

it("does not revive callbacks after a failed save-before-lock transition", async () => {
  const setup = await callbackSetup();
  captureRetainedTextEdit(setup.actions, ids.card, "text")!.complete("Dirty");
  const captured = setup.actions.captureDelete([ids.image])!;
  setup.client.saveDocument.mockResolvedValue({
    ok: false,
    error: { code: "save_failure", message: "Test failure", retryable: true },
  });
  expect((await setup.controller.lock()).ok).toBe(false);
  expect(setup.controller.getSnapshot()).toMatchObject({ phase: "unlocked", busy: false });
  const before = setup.store.getState().documentWorkspace;
  expect(captured.complete()).toEqual({ ok: false, code: "expired-action" });
  expect(setup.store.getState().documentWorkspace).toBe(before);
  await setup.dispose();
});

it("consumes actions once, revokes cancelled/superseded actions, and keeps unrelated slots alive", async () => {
  const setup = await callbackSetup();
  const old = captureRetainedTextEdit(setup.actions, ids.card, "text")!;
  const edit = captureRetainedTextEdit(setup.actions, ids.card, "text")!;
  const layer = setup.actions.captureLayers([ids.container], "front")!;
  expect(old.complete("Old")).toEqual({ ok: false, code: "expired-action" });
  expect(edit.complete("New")).toEqual({ ok: true, changed: true });
  expect(edit.complete("Again")).toEqual({ ok: false, code: "expired-action" });
  expect(layer.complete()).toEqual({ ok: true, changed: true });
  const remove = setup.actions.captureDelete([ids.image])!;
  remove.cancel();
  expect(remove.complete()).toEqual({ ok: false, code: "expired-action" });
  await setup.dispose();
});

it("consumes before notifying store subscribers, preventing reentrant replay", async () => {
  const setup = await callbackSetup();
  const edit = captureRetainedTextEdit(setup.actions, ids.card, "text")!;
  const replay = vi.fn(() =>
    expect(edit.complete("Replay")).toEqual({ ok: false, code: "expired-action" }),
  );
  const unsubscribe = setup.store.subscribe(replay);
  expect(edit.complete("Once")).toEqual({ ok: true, changed: true });
  expect(replay).toHaveBeenCalled();
  expect(setup.store.getState().documentWorkspace.history.past).toHaveLength(1);
  unsubscribe();
  await setup.dispose();
});
