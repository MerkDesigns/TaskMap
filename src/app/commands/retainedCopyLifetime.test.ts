// @vitest-environment node
import { expect, it } from "vitest";
import { callbackSetup } from "./retainedCallbackTestSupport";
import { geometryIds as ids } from "./retainedGeometryTestSupport";
import { copyInput, prepareCopy } from "./retainedCopyTestSupport";
import { TEST_IDS } from "../../elements/cardContainerTestFixtures";

it.each([
  "lock",
  "failed-lock",
  "reload",
  "clear-workspace",
  "clear-actions",
  "dispose",
  "supersede",
  "cancel",
])("revokes copied plaintext on %s", async (reason) => {
  const setup = await callbackSetup(copyInput());
  const { completion } = prepareCopy(setup.store.getState().documentWorkspace.document!);
  const captured = setup.actions.captureCopy(Object.values(ids))!;
  if (reason === "failed-lock") {
    setup.actions
      .captureMove(ids.block, [ids.block])!
      .complete({ operation: setup.move([ids.block]) });
    setup.client.saveDocument.mockResolvedValue({
      ok: false,
      error: { code: "save_failure", message: "Test failure", retryable: true },
    });
  }
  if (reason === "lock" || reason === "failed-lock") {
    expect((await setup.controller.lock()).ok).toBe(reason === "lock");
    if (reason === "lock")
      expect((await setup.controller.unlock("test-only-password")).ok).toBe(true);
    else expect(setup.controller.getSnapshot()).toMatchObject({ phase: "unlocked", busy: false });
  }
  if (reason === "reload")
    setup.store.workspace.load(setup.store.getState().documentWorkspace.document!, 4);
  if (reason === "clear-workspace") setup.store.workspace.clear();
  if (reason === "clear-actions") setup.actions.clear();
  if (reason === "dispose") setup.actions.dispose();
  if (reason === "supersede") setup.actions.captureCopy([ids.card]);
  if (reason === "cancel") captured.cancel();
  const before = setup.store.getState().documentWorkspace;
  expect(captured.complete(completion)).toEqual({ ok: false, code: "expired-action" });
  expect(setup.store.getState().documentWorkspace).toBe(before);
  await setup.dispose();
});

it("keeps Copy through canvas changes while cancelling canvas-scoped edits and previews", async () => {
  const setup = await callbackSetup(copyInput());
  const { completion } = prepareCopy(setup.store.getState().documentWorkspace.document!);
  const copy = setup.actions.captureCopy(Object.values(ids))!;
  const move = setup.actions.captureMove(ids.block, [ids.block])!;
  const operation = setup.move([ids.block]);
  let invalidations = 0;
  const unsubscribe = setup.actions.subscribeInvalidation(() => {
    invalidations += 1;
  });
  for (const canvasId of [TEST_IDS.canvasB, TEST_IDS.canvasA])
    setup.store.workspace.dispatchCommand({
      type: "document.canvas.set-active",
      payload: { canvasId },
    });
  expect(invalidations).toBe(2);
  expect(move.complete({ operation })).toEqual({ ok: false, code: "expired-action" });
  expect(copy.complete(completion)).toEqual({ ok: true, changed: true });
  unsubscribe();
  await setup.dispose();
});

it("consumes the copy before reentrant replay and does not invalidate unrelated captures", async () => {
  const setup = await callbackSetup(copyInput());
  const { completion } = prepareCopy(setup.store.getState().documentWorkspace.document!);
  const copy = setup.actions.captureCopy(Object.values(ids))!;
  const edit = setup.actions.captureContent([{ elementId: ids.block, fields: ["text"] }])!;
  const unsubscribe = setup.store.subscribe(() => {
    expect(copy.complete(completion)).toEqual({ ok: false, code: "expired-action" });
  });
  expect(copy.complete(completion)).toEqual({ ok: true, changed: true });
  unsubscribe();
  expect(edit.complete(null)).toEqual({ ok: true, changed: false });
  await setup.dispose();
});
