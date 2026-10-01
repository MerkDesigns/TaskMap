// @vitest-environment node
import { expect, it, vi } from "vitest";
import { asEntityId } from "../../domain/ids/entityIds";
import { TEST_IDS } from "../../elements/cardContainerTestFixtures";
import { callbackSetup } from "./retainedCallbackTestSupport";
import { geometryInput, geometryIds as ids } from "./retainedGeometryTestSupport";
import { installIds } from "./retainedExtensionTestSupport";

it("keeps repeated cancelled captures transient without additional observers or serialization", async () => {
  const setup = await callbackSetup();
  const observeStore = vi.spyOn(setup.store, "subscribe");
  const observeSession = vi.spyOn(setup.controller, "subscribe");
  const dispatch = vi.spyOn(setup.store.workspace, "dispatchCommand");
  const serialize = vi.spyOn(JSON, "stringify");
  const before = setup.store.getState().documentWorkspace;
  try {
    for (let i = 0; i < 200; i++) {
      const captured = setup.actions.captureExtensionInstall("lock", Object.values(ids))!;
      captured.cancel();
      expect(captured.complete(installIds(Object.values(ids)))).toEqual({
        ok: false,
        code: "expired-action",
      });
    }
    expect(
      setup.actions.captureExtensionInstall("lock", Object.values(ids))!.complete(null),
    ).toEqual({ ok: true, changed: false });
    expect(observeStore).not.toHaveBeenCalled();
    expect(observeSession).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
    expect(serialize).not.toHaveBeenCalled();
    expect(setup.scheduler.size).toBe(0);
    expect(setup.store.getState().documentWorkspace).toBe(before);
  } finally {
    vi.restoreAllMocks();
  }
  await setup.dispose();
});

it("records one localized extension transaction for a large group and defers saving", async () => {
  const input = geometryInput();
  const targets = Array.from({ length: 1000 }, (_, index) =>
    asEntityId(
      "element",
      `element-00000000-0000-4000-8000-${String(index + 1000).padStart(12, "0")}`,
    ),
  );
  for (const id of targets) {
    input.elements[id] = { ...input.elements[ids.block], id };
    input.canvases[TEST_IDS.canvasA].elementOrder.push(id);
  }
  const setup = await callbackSetup(input);
  const before = setup.store.getState().documentWorkspace.document!;
  const serialize = vi.spyOn(JSON, "stringify");
  try {
    expect(
      setup.actions.captureExtensionInstall("lock", targets)!.complete(installIds(targets)),
    ).toEqual({ ok: true, changed: true });
    const workspace = setup.store.getState().documentWorkspace;
    expect(workspace.document!.elements).toBe(before.elements);
    expect(workspace.document!.mediaReferences).toBe(before.mediaReferences);
    expect(workspace.history.past).toHaveLength(1);
    expect(workspace.history.past[0].patches).toHaveLength(targets.length);
    expect(
      workspace.history.past[0].patches.every(
        (patch) => patch.path.length === 2 && patch.path[0] === "extensionInstallations",
      ),
    ).toBe(true);
    expect(Object.values(workspace.document!.extensionInstallations)).toHaveLength(1000);
    expect(serialize).not.toHaveBeenCalled();
    expect(setup.client.saveDocument).not.toHaveBeenCalled();
    expect(setup.scheduler.size).toBe(1);
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
