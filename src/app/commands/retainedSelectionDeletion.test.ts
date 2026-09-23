// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createAppStore } from "../store";
import { acceptRetainedDocument } from "../database/acceptRetainedDocument";
import { retainedDocumentCommandHandlers } from "./retainedDocumentCommandHandlers";
import { createImageInput, IMAGE_TEST_IDS } from "../../elements/image/imageTestFixtures";
import { TEST_IDS as ids } from "../../elements/cardContainerTestFixtures";
import { FakePersistenceScheduler, savedDocument } from "../workspace/workspaceTestSupport";

function setup(input = createImageInput()) {
  const scheduler = new FakePersistenceScheduler();
  const saveDocument = vi.fn(async () => savedDocument(5));
  const store = createAppStore({
    acceptDocument: acceptRetainedDocument,
    commandHandlers: retainedDocumentCommandHandlers,
    persistence: { databaseClient: { saveDocument }, scheduler },
  });
  if (!store.workspace.load(input, 4).ok) throw new Error("Invalid deletion fixture");
  return { store, scheduler, saveDocument };
}
const remove = (elementIds: string[], canvasId: string = ids.canvasA) => ({
  type: "document.selection.delete",
  payload: { canvasId, elementIds },
});
function lockedInput(target = ids.elementA, installationEnabled = true, configuredEnabled = true) {
  const input = createImageInput();
  input.documentSettings.allowLockedElementDeletion = false;
  input.extensionInstallations[ids.extensionA] = {
    id: ids.extensionA,
    extensionId: "lock",
    enabled: installationEnabled,
    target: { kind: "element", elementId: target },
    configuration: { enabled: configuredEnabled },
  };
  return input;
}

describe("retained atomic selection deletion", () => {
  it("cascades children/edges/extensions together, retains media, and undoes/redoes one transaction", async () => {
    const input = lockedInput();
    input.documentSettings.allowLockedElementDeletion = true;
    input.connections[ids.connection] = {
      id: ids.connection,
      canvasId: ids.canvasA,
      type: "mind-map",
      data: {},
      source: { elementId: ids.elementA, portId: "right" },
      target: { elementId: IMAGE_TEST_IDS.image, portId: "left" },
    };
    const { store, scheduler, saveDocument } = setup(input);
    const before = store.getState().documentWorkspace.document!;
    expect(
      store.workspace.dispatchCommand(remove([ids.elementA, ids.elementB, IMAGE_TEST_IDS.image])),
    ).toMatchObject({ ok: true, changed: true });
    const after = store.getState().documentWorkspace;
    expect(after.document?.elements).toEqual({});
    expect(after.document?.connections).toEqual({});
    expect(after.document?.extensionInstallations).toEqual({});
    expect(after.document?.canvases[ids.canvasA].elementOrder).toEqual([]);
    expect(after.document?.mediaReferences).toBe(before.mediaReferences);
    expect(after.history.past).toHaveLength(1);
    expect(scheduler.size).toBe(1);
    expect(store.workspace.undo().ok).toBe(true);
    expect(store.getState().documentWorkspace.document).toEqual(before);
    expect(store.workspace.redo().ok).toBe(true);
    await store.workspace.flushSave();
    expect(saveDocument).toHaveBeenCalledTimes(1);
    store.disposeWorkspace();
  });

  it.each([ids.elementA, ids.elementB, IMAGE_TEST_IDS.image])(
    "protects a container when it or a child is locked (%s)",
    (target) => {
      const { store, scheduler } = setup(lockedInput(target));
      const before = store.getState().documentWorkspace;
      expect(store.workspace.dispatchCommand(remove([ids.elementA]))).toMatchObject({
        ok: true,
        changed: false,
      });
      expect(store.getState().documentWorkspace).toBe(before);
      expect(scheduler.size).toBe(0);
      store.disposeWorkspace();
    },
  );

  it("skips protected selection entries but still deletes explicitly selected unlocked children", () => {
    const { store } = setup(lockedInput(IMAGE_TEST_IDS.image));
    expect(
      store.workspace.dispatchCommand(remove([ids.elementA, ids.elementB, IMAGE_TEST_IDS.image])),
    ).toMatchObject({ ok: true, changed: true });
    const state = store.getState().documentWorkspace;
    expect(Object.keys(state.document!.elements)).toEqual([ids.elementA, IMAGE_TEST_IDS.image]);
    expect(state.history.past).toHaveLength(1);
    store.disposeWorkspace();
  });

  it("a locked parent does not independently protect an unlocked child's deletion", () => {
    const { store } = setup(lockedInput());
    expect(store.workspace.dispatchCommand(remove([ids.elementB])).ok).toBe(true);
    expect(store.getState().documentWorkspace.document!.elements[ids.elementB]).toBeUndefined();
    expect(store.getState().documentWorkspace.document!.elements[ids.elementA]).toBeDefined();
    store.disposeWorkspace();
  });

  it.each([
    [false, true],
    [true, false],
    [false, false],
  ])("respects installation enabled=%s and configured lock=%s", (active, configured) => {
    const { store } = setup(lockedInput(ids.elementB, active, configured));
    expect(store.workspace.dispatchCommand(remove([ids.elementA]))).toMatchObject({
      ok: true,
      changed: true,
    });
    expect(store.getState().documentWorkspace.document?.elements).toEqual({});
    store.disposeWorkspace();
  });

  it.each([false, true])(
    "the single-element entry point shares protection/cascade, allow=%s",
    (allow) => {
      const input = lockedInput(ids.elementB);
      input.documentSettings.allowLockedElementDeletion = allow;
      const { store } = setup(input);
      expect(
        store.workspace.dispatchCommand({
          type: "document.element.remove",
          payload: { elementId: ids.elementA },
        }),
      ).toMatchObject({ ok: true, changed: allow });
      expect(Object.keys(store.getState().documentWorkspace.document!.elements)).toHaveLength(
        allow ? 0 : 3,
      );
      store.disposeWorkspace();
    },
  );

  it.each([
    remove([ids.elementB, ids.elementB]),
    remove([ids.elementB, "element-00000000-0000-4000-8000-000000000099"]),
    remove([ids.elementB], ids.canvasB),
    remove(["invalid-id"]),
    {
      type: "document.selection.delete",
      payload: { canvasId: ids.canvasA, elementIds: [ids.elementB], force: true },
    },
  ])(
    "rejects stale/duplicate/cross-canvas/malformed targets or force bypass atomically",
    (command) => {
      const { store, scheduler } = setup();
      const before = store.getState().documentWorkspace;
      expect(store.workspace.dispatchCommand(command).ok).toBe(false);
      expect(store.getState().documentWorkspace).toBe(before);
      expect(scheduler.size).toBe(0);
      store.disposeWorkspace();
    },
  );

  it("keeps empty selection a no-op and survivors' order/geometry unchanged", () => {
    const { store } = setup();
    const before = store.getState().documentWorkspace;
    expect(store.workspace.dispatchCommand(remove([]))).toMatchObject({ ok: true, changed: false });
    expect(store.getState().documentWorkspace).toBe(before);
    store.workspace.dispatchCommand(remove([ids.elementB]));
    const after = store.getState().documentWorkspace.document!;
    expect(after.elements[IMAGE_TEST_IDS.image]).toBe(
      before.document!.elements[IMAGE_TEST_IDS.image],
    );
    expect(after.canvases[ids.canvasA].elementOrder).toEqual([ids.elementA, IMAGE_TEST_IDS.image]);
    store.disposeWorkspace();
  });
});
