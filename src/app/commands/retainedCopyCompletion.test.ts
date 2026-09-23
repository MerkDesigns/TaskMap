// @vitest-environment node
import { expect, it } from "vitest";
import { callbackSetup } from "./retainedCallbackTestSupport";
import { geometryIds as ids, geometryInput } from "./retainedGeometryTestSupport";
import { copyInput, prepareCopy } from "./retainedCopyTestSupport";
import { TEST_IDS } from "../../elements/cardContainerTestFixtures";
import { captureRetainedCopy } from "./retainedCopySnapshot";

it.each(Object.values(ids))("copies retained type %s without changing the source", async (id) => {
  const setup = await callbackSetup(copyInput());
  const before = setup.store.getState().documentWorkspace.document!;
  const { snapshot, completion } = prepareCopy(before, [id]);
  const captured = setup.actions.captureCopy([id])!;
  expect(captured.complete(completion)).toEqual({ ok: true, changed: true });
  const after = setup.store.getState().documentWorkspace.document!;
  for (const source of snapshot.elements) {
    const mapped = completion.elements.find((entry) => entry.sourceId === source.id)!;
    const duplicate = after.elements[mapped.id];
    expect(after.elements[source.id]).toBe(before.elements[source.id]);
    expect(duplicate.geometry).toEqual({ ...source.geometry, ...mapped.position });
    if (source.type === "container" || source.type === "text-block")
      expect(duplicate.data.name).toBe(`${source.data.name} copy`);
    if ((source.type === "text-card" || source.type === "image") && source.id === id)
      expect(duplicate.data.placement).toBeNull();
  }
  expect(after.mediaReferences).toBe(before.mediaReferences);
  expect(after.documentSettings).toBe(before.documentSettings);
  expect(setup.store.getState().documentWorkspace.history.past).toHaveLength(1);
  expect(setup.store.workspace.undo().ok).toBe(true);
  expect(setup.store.getState().documentWorkspace.document).toEqual(before);
  expect(setup.store.workspace.redo().ok).toBe(true);
  expect(captured.complete(completion)).toEqual({ ok: false, code: "expired-action" });
  await setup.store.workspace.flushSave();
  expect(setup.client.saveDocument).toHaveBeenCalledTimes(1);
  await setup.dispose();
});

it("remaps a mixed graph, parent/child, internal edges and every installation in one transaction", async () => {
  const setup = await callbackSetup(copyInput());
  const before = setup.store.getState().documentWorkspace.document!;
  const { completion } = prepareCopy(before);
  expect(
    setup.actions.captureCopy([...Object.values(ids), ids.container])!.complete(completion),
  ).toEqual({ ok: true, changed: true });
  const after = setup.store.getState().documentWorkspace.document!;
  const mapped = (id: string) => completion.elements.find(({ sourceId }) => id === sourceId)!.id;
  expect(after.elements[mapped(ids.card)].data.placement).toEqual({
    containerId: mapped(ids.container),
    order: 3,
  });
  expect(after.connections[completion.connections[0].id]).toMatchObject({
    source: { elementId: mapped(ids.container), portId: "right" },
    target: { elementId: mapped(ids.image), portId: "left" },
  });
  expect(after.extensionInstallations[completion.installations[0].id]).toMatchObject({
    enabled: false,
    configuration: { enabled: true },
    target: { kind: "element", elementId: mapped(ids.container) },
  });
  expect(after.extensionInstallations[completion.installations[1].id]).toMatchObject({
    configuration: { checked: true },
    target: { kind: "element", elementId: mapped(ids.card) },
  });
  expect(after.elements[mapped(ids.image)].data.mediaId).toBe(TEST_IDS.media);
  expect(after.canvases[TEST_IDS.canvasA].elementOrder.slice(-5)).toEqual(
    completion.elements.map(({ id }) => id),
  );
  expect(setup.store.getState().documentWorkspace.history.past).toHaveLength(1);
  expect(setup.store.workspace.undo().ok).toBe(true);
  expect(setup.store.getState().documentWorkspace.document).toEqual(before);
  await setup.dispose();
});

it("keeps copy-time values after source edits/deletion and allows pasting across canvases", async () => {
  const setup = await callbackSetup(copyInput());
  const source = setup.store.getState().documentWorkspace.document!;
  const { completion } = prepareCopy(source);
  const captured = setup.actions.captureCopy(Object.values(ids))!;
  setup.store.workspace.dispatchCommand({
    type: "document.element.replace-data",
    payload: {
      elementId: ids.block,
      data: { ...source.elements[ids.block].data, text: "Changed after copy" },
    },
  });
  setup.actions.captureDelete([ids.image])!.complete();
  setup.store.workspace.dispatchCommand({
    type: "document.canvas.set-active",
    payload: { canvasId: TEST_IDS.canvasB },
  });
  completion.canvasId = TEST_IDS.canvasB;
  expect(captured.complete(completion)).toEqual({ ok: true, changed: true });
  const after = setup.store.getState().documentWorkspace.document!;
  const newBlock = completion.elements.find(({ sourceId }) => sourceId === ids.block)!.id;
  expect(after.elements[newBlock].data.text).toBe(source.elements[ids.block].data.text);
  expect(after.canvases[TEST_IDS.canvasB].elementOrder).toEqual(
    completion.elements.map(({ id }) => id),
  );
  expect(after.connections[completion.connections[0].id].canvasId).toBe(TEST_IDS.canvasB);
  expect(after.mediaReferences).toBe(source.mediaReferences);
  await setup.dispose();
});

it("preserves legacy text-card-only container expansion and excludes dangling edges", async () => {
  const setup = await callbackSetup(geometryInput());
  const source = setup.store.getState().documentWorkspace.document!;
  const snapshot = captureRetainedCopy(source, [ids.container, ids.image])!;
  expect(snapshot.elements.map(({ id }) => id)).toEqual([ids.container, ids.card]);
  expect(snapshot.media).toEqual([]);
  expect(snapshot.elements[1].data).not.toBe(source.elements[ids.card].data);
  expect(captureRetainedCopy(source, [])).toBeNull();
  await setup.dispose();
});

it("drops edges to uncopied endpoints and handles empty image placeholders", async () => {
  const input = copyInput();
  input.elements[ids.image].data.mediaId = null;
  const setup = await callbackSetup(input);
  const before = setup.store.getState().documentWorkspace.document!;
  const { snapshot, completion } = prepareCopy(before, [ids.image]);
  expect(snapshot.connections).toEqual([]);
  expect(snapshot.media).toEqual([]);
  expect(setup.actions.captureCopy([ids.image])!.complete(completion).ok).toBe(true);
  await setup.dispose();
});
