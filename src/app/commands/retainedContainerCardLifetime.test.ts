// @vitest-environment node
import { expect, it, vi } from "vitest";
import { callbackSetup } from "./retainedCallbackTestSupport";
import { geometryIds as ids } from "./retainedGeometryTestSupport";
import {
  containerCardInput,
  newContainerCard,
  aiPayload,
  aiIdentities,
} from "./retainedContainerCardTestSupport";
import { TEST_IDS } from "../../elements/cardContainerTestFixtures";
import { extensionTestId } from "./retainedExtensionTestSupport";

it.each([
  "lock",
  "failed-lock",
  "reload",
  "canvas-round-trip",
  "clear",
  "dispose",
  "cancel",
  "supersede",
])("revokes creation and asynchronous JSON replacement on %s", async (reason) => {
  for (const action of ["create", "json"]) {
    const setup = await callbackSetup(containerCardInput());
    const creation =
      action === "create" ? setup.actions.captureNewContainerCard(ids.container, 0)! : null;
    const json =
      action === "json" ? setup.actions.captureContainerJsonReplace(ids.container)! : null;
    if (reason === "failed-lock") {
      setup.actions
        .captureMove(ids.block, [ids.block])!
        .complete({ operation: setup.move([ids.block]) });
      setup.client.saveDocument.mockResolvedValue({
        ok: false,
        error: { code: "save_failure", message: "Test failure", retryable: true },
      });
    }
    if (reason === "lock" || reason === "failed-lock")
      expect((await setup.controller.lock()).ok).toBe(reason === "lock");
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
    if (reason === "cancel") {
      creation?.cancel();
      json?.cancel();
    }
    if (reason === "supersede") setup.actions.captureNewContainerCard(ids.container, 0);
    const before = setup.store.getState().documentWorkspace;
    const result = creation
      ? creation.complete(newContainerCard())
      : json!.complete({ json: JSON.stringify(aiPayload()), cards: aiIdentities() });
    expect(result).toEqual({ ok: false, code: "expired-action" });
    expect(setup.store.getState().documentWorkspace).toBe(before);
    await setup.dispose();
  }
});

it("consumes before reentrant subscribers and keeps invalid starts from superseding valid captures", async () => {
  const setup = await callbackSetup(containerCardInput());
  const captured = setup.actions.captureNewContainerCard(ids.container, 0)!;
  expect(setup.actions.captureNewContainerCard(ids.block, 0)).toBeNull();
  expect(setup.actions.captureNewContainerCard(ids.container, -1)).toBeNull();
  expect(setup.actions.captureNewContainerCard(ids.container, 3)).toBeNull();
  const unsubscribe = setup.store.subscribe(() => {
    expect(captured.complete(newContainerCard())).toEqual({ ok: false, code: "expired-action" });
  });
  expect(captured.complete(newContainerCard())).toEqual({ ok: true, changed: true });
  unsubscribe();
  await setup.dispose();
});

it("does not capture/export AI actions from inactive or missing installations", async () => {
  const input = containerCardInput();
  input.extensionInstallations[extensionTestId(0)].enabled = false;
  const setup = await callbackSetup(input);
  expect(setup.actions.captureContainerJsonReplace(ids.container)).toBeNull();
  expect(setup.actions.getContainerJsonForAi(ids.container)).toBeNull();
  expect(setup.actions.captureContainerJsonReplace(ids.block)).toBeNull();
  await setup.dispose();
});

it("does no parsing, serialization, dispatch or observation work for cancelled/null completion", async () => {
  const setup = await callbackSetup(containerCardInput());
  const before = setup.store.getState().documentWorkspace;
  const dispatch = vi.spyOn(setup.store.workspace, "dispatchCommand");
  const storeObserver = vi.spyOn(setup.store, "subscribe");
  const sessionObserver = vi.spyOn(setup.controller, "subscribe");
  const parse = vi.spyOn(JSON, "parse");
  const serialize = vi.spyOn(JSON, "stringify");
  try {
    for (let i = 0; i < 200; i++) {
      const captured = setup.actions.captureContainerJsonReplace(ids.container)!;
      captured.cancel();
      expect(captured.complete({ json: "not parsed", cards: [] })).toEqual({
        ok: false,
        code: "expired-action",
      });
    }
    expect(setup.actions.captureNewContainerCard(ids.container, 0)!.complete(null)).toEqual({
      ok: true,
      changed: false,
    });
    expect(setup.actions.captureContainerJsonReplace(ids.container)!.complete(null)).toEqual({
      ok: true,
      changed: false,
    });
    for (const mock of [dispatch, storeObserver, sessionObserver, parse, serialize])
      expect(mock).not.toHaveBeenCalled();
    expect(setup.scheduler.size).toBe(0);
    expect(setup.store.getState().documentWorkspace).toBe(before);
  } finally {
    vi.restoreAllMocks();
  }
  await setup.dispose();
});
