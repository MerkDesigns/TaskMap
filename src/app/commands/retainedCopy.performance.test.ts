// @vitest-environment node
import { expect, it, vi } from "vitest";
import { callbackSetup } from "./retainedCallbackTestSupport";
import { copyInput, copiedElementId, prepareCopy } from "./retainedCopyTestSupport";
import { geometryIds as ids } from "./retainedGeometryTestSupport";
import { TEST_IDS } from "../../elements/cardContainerTestFixtures";

it("keeps repeated Copy/null/cancel transient with no observer growth, serialization or writes", async () => {
  const setup = await callbackSetup(copyInput());
  const before = setup.store.getState().documentWorkspace;
  const storeObserver = vi.spyOn(setup.store, "subscribe");
  const sessionObserver = vi.spyOn(setup.controller, "subscribe");
  const serialize = vi.spyOn(JSON, "stringify");
  const dispatch = vi.spyOn(setup.store.workspace, "dispatchCommand");
  try {
    for (let index = 0; index < 200; index++) {
      const copy = setup.actions.captureCopy(Object.values(ids))!;
      copy.cancel();
      expect(copy.complete(null)).toEqual({ ok: false, code: "expired-action" });
    }
    expect(setup.actions.captureCopy([ids.card])!.complete(null)).toEqual({
      ok: true,
      changed: false,
    });
    expect(storeObserver).not.toHaveBeenCalled();
    expect(sessionObserver).not.toHaveBeenCalled();
    expect(serialize).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
    expect(setup.client.saveDocument).not.toHaveBeenCalled();
    expect(setup.scheduler.size).toBe(0);
    expect(setup.store.getState().documentWorkspace).toBe(before);
  } finally {
    vi.restoreAllMocks();
  }
  await setup.dispose();
});

it("pastes a thousand members with one localized history transaction and one deferred save", async () => {
  const input = copyInput();
  const targets = Array.from({ length: 1000 }, (_, index) => copiedElementId(1000 + index));
  for (const id of targets) {
    input.elements[id] = { ...input.elements[ids.block], id };
    input.canvases[TEST_IDS.canvasA].elementOrder.push(id);
  }
  const setup = await callbackSetup(input);
  const before = setup.store.getState().documentWorkspace.document!;
  const { completion } = prepareCopy(before, targets);
  const serialize = vi.spyOn(JSON, "stringify");
  try {
    expect(setup.actions.captureCopy(targets)!.complete(completion)).toEqual({
      ok: true,
      changed: true,
    });
    const workspace = setup.store.getState().documentWorkspace;
    expect(workspace.history.past).toHaveLength(1);
    expect(workspace.history.past[0].patches).toHaveLength(2000);
    expect(
      workspace.history.past[0].patches.every(
        (patch) =>
          (patch.path[0] === "elements" && patch.path.length === 2) ||
          (patch.path[0] === "canvases" &&
            patch.path[2] === "elementOrder" &&
            patch.path.length === 4),
      ),
    ).toBe(true);
    expect(workspace.document!.mediaReferences).toBe(before.mediaReferences);
    expect(workspace.document!.extensionInstallations).toBe(before.extensionInstallations);
    expect(serialize).not.toHaveBeenCalled();
    expect(setup.scheduler.size).toBe(1);
    expect(setup.client.saveDocument).not.toHaveBeenCalled();
    expect(setup.store.workspace.undo().ok).toBe(true);
    expect(setup.store.getState().documentWorkspace.document).toEqual(before);
    expect(setup.store.workspace.redo().ok).toBe(true);
  } finally {
    serialize.mockRestore();
  }
  await setup.store.workspace.flushSave();
  expect(setup.client.saveDocument).toHaveBeenCalledTimes(1);
  await setup.dispose();
});
