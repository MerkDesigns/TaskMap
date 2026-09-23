// @vitest-environment node
import { expect, it } from "vitest";
import { callbackSetup } from "./retainedCallbackTestSupport";
import { geometryIds as ids } from "./retainedGeometryTestSupport";
import { installIds } from "./retainedExtensionTestSupport";
import { TEST_IDS } from "../../elements/cardContainerTestFixtures";

const actionNames = ["install", "remove", "configuration", "activation", "toggle"] as const;
function capture(
  setup: Awaited<ReturnType<typeof callbackSetup>>,
  action: (typeof actionNames)[number],
) {
  const { actions } = setup;
  switch (action) {
    case "install": {
      const captured = actions.captureExtensionInstall("privacy", [ids.container])!;
      return () => captured.complete(installIds([ids.container]));
    }
    case "remove": {
      const captured = actions.captureExtensionRemove("lock", [ids.card])!;
      return () => captured.complete();
    }
    case "configuration": {
      const captured = actions.captureExtensionConfiguration("lock", ids.card)!;
      return () => captured.complete({ enabled: false });
    }
    case "activation": {
      const captured = actions.captureExtensionActivation("lock", ids.card)!;
      return () => captured.complete(false);
    }
    case "toggle": {
      const captured = actions.captureExtensionToggle("lock", ids.card)!;
      return () => captured.complete();
    }
  }
}

it.each(
  actionNames.flatMap((action) =>
    ["lock", "failed-lock", "reload", "canvas-round-trip", "clear", "dispose"].map((reason) => ({
      action,
      reason,
    })),
  ),
)("revokes $action on $reason", async ({ action, reason }) => {
  const setup = await callbackSetup();
  setup.actions.captureExtensionInstall("lock", [ids.card])!.complete(installIds([ids.card]));
  const complete = capture(setup, action);
  if (reason === "failed-lock")
    setup.client.saveDocument.mockResolvedValue({
      ok: false,
      error: { code: "save_failure", message: "Test failure", retryable: true },
    });
  if (reason === "lock" || reason === "failed-lock") {
    expect((await setup.controller.lock()).ok).toBe(reason === "lock");
    if (reason === "failed-lock")
      expect(setup.controller.getSnapshot()).toMatchObject({ phase: "unlocked", busy: false });
  }
  if (reason === "reload")
    setup.store.workspace.load(setup.store.getState().documentWorkspace.document!, 4);
  if (reason === "canvas-round-trip")
    for (const canvasId of [TEST_IDS.canvasB, TEST_IDS.canvasA])
      setup.store.workspace.dispatchCommand({
        type: "document.canvas.set-active",
        payload: { canvasId },
      });
  if (reason === "clear") setup.actions.clear();
  if (reason === "dispose") setup.actions.dispose();
  const before = setup.store.getState().documentWorkspace;
  expect(complete()).toEqual({ ok: false, code: "expired-action" });
  expect(setup.store.getState().documentWorkspace).toBe(before);
  await setup.dispose();
});

it("consumes actions before replay, shares one slot, and preserves unrelated action slots", async () => {
  const setup = await callbackSetup();
  const old = setup.actions.captureExtensionInstall("lock", [ids.card])!;
  const current = setup.actions.captureExtensionInstall("privacy", [ids.container])!;
  const edit = setup.actions.captureContent([{ elementId: ids.card, fields: ["text"] }])!;
  expect(old.complete(installIds([ids.card]))).toEqual({ ok: false, code: "expired-action" });
  const unsubscribe = setup.store.subscribe(() => {
    expect(current.complete(installIds([ids.container]))).toEqual({
      ok: false,
      code: "expired-action",
    });
  });
  expect(current.complete(installIds([ids.container]))).toEqual({ ok: true, changed: true });
  unsubscribe();
  expect(edit.complete(null)).toEqual({ ok: true, changed: false });
  await setup.dispose();
});
