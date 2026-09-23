// @vitest-environment node
import { expect, it, vi } from "vitest";
import { callbackSetup } from "./retainedCallbackTestSupport";
import { geometryIds as ids } from "./retainedGeometryTestSupport";
import { containerCardInput, aiPayload, aiIdentities } from "./retainedContainerCardTestSupport";
import { TEST_IDS } from "../../elements/cardContainerTestFixtures";
import { extensionTestId } from "./retainedExtensionTestSupport";

it("replaces 1,000 cards in one transaction without saving/re-encoding media during completion", async () => {
  const setup = await callbackSetup(containerCardInput());
  const before = setup.store.getState().documentWorkspace.document!;
  const cards = aiIdentities(1000);
  const json = JSON.stringify(aiPayload(1000));
  const serialize = vi.spyOn(JSON, "stringify");
  try {
    expect(
      setup.actions.captureContainerJsonReplace(ids.container)!.complete({ json, cards }),
    ).toEqual({ ok: true, changed: true });
    const after = setup.store.getState().documentWorkspace;
    expect(after.history.past).toHaveLength(1);
    expect(
      after.history.past[0].patches.every((patch) =>
        ["elements", "extensionInstallations", "canvases"].includes(String(patch.path[0])),
      ),
    ).toBe(true);
    expect(after.document!.mediaReferences).toBe(before.mediaReferences);
    expect(after.document!.connections).toBe(before.connections);
    expect(after.document!.documentSettings).toBe(before.documentSettings);
    expect(after.document!.elements[ids.image].geometry).toBe(before.elements[ids.image].geometry);
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

it("treats empty-to-empty equal JSON replacement as a true no-op, preserving image order gaps", async () => {
  const input = containerCardInput();
  delete input.elements[ids.card];
  delete input.extensionInstallations[extensionTestId(5)];
  input.canvases[TEST_IDS.canvasA].elementOrder = input.canvases[
    TEST_IDS.canvasA
  ].elementOrder.filter((id) => id !== ids.card);
  const setup = await callbackSetup(input);
  const before = setup.store.getState().documentWorkspace;
  const json = setup.actions.getContainerJsonForAi(ids.container)!;
  expect(
    setup.actions.captureContainerJsonReplace(ids.container)!.complete({ json, cards: [] }),
  ).toEqual({ ok: true, changed: false });
  expect(setup.store.getState().documentWorkspace).toBe(before);
  expect(setup.scheduler.size).toBe(0);
  await setup.dispose();
});
