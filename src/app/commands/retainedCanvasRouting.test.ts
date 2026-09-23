// @vitest-environment node
import { expect, it } from "vitest";
import { callbackSetup } from "./retainedCallbackTestSupport";
import { geometryIds as ids } from "./retainedGeometryTestSupport";
import { TEST_IDS } from "../../elements/cardContainerTestFixtures";
import { asEntityId } from "../../domain/ids/entityIds";

it("creates/activates a canvas atomically and prevents deleting the final canvas", async () => {
  const setup = await callbackSetup();
  const id = asEntityId("canvas", "canvas-00000000-0000-4000-8000-000000000090");
  expect(
    setup.actions
      .captureCreateCanvas()!
      .complete({ id, name: "New", settings: { width: 1000, height: 1000 }, elementOrder: [] }),
  ).toEqual({ ok: true, changed: true });
  expect(setup.store.getState().documentWorkspace.document!.activeCanvasId).toBe(id);
  expect(setup.actions.undo().ok).toBe(true);
  expect(setup.actions.captureRemoveCanvas(TEST_IDS.canvasB)!.complete(true).ok).toBe(true);
  const before = setup.store.getState().documentWorkspace;
  expect(setup.actions.captureRemoveCanvas(TEST_IDS.canvasA)!.complete(true).ok).toBe(false);
  expect(setup.store.getState().documentWorkspace).toBe(before);
  await setup.dispose();
});

it("clear keeps canvas/media and atomically restores all elements with undo", async () => {
  const setup = await callbackSetup();
  const before = setup.store.getState().documentWorkspace.document!;
  expect(setup.actions.captureRemoveCanvas(TEST_IDS.canvasA, "clear")!.complete(true)).toEqual({
    ok: true,
    changed: true,
  });
  const after = setup.store.getState().documentWorkspace.document!;
  expect(after.canvases[TEST_IDS.canvasA].elementOrder).toEqual([]);
  expect(after.mediaReferences).toBe(before.mediaReferences);
  expect(setup.actions.undo().ok).toBe(true);
  expect(setup.store.getState().documentWorkspace.document).toEqual(before);
  await setup.dispose();
});

it("rejects stale destructive confirmation after child content changes", async () => {
  const setup = await callbackSetup();
  const remove = setup.actions.captureRemoveCanvas(TEST_IDS.canvasA)!;
  setup.actions
    .captureContent([{ elementId: ids.card, fields: ["text"] }])!
    .complete([{ elementId: ids.card, to: { text: "Changed" } }]);
  const before = setup.store.getState().documentWorkspace;
  expect(remove.complete(true).ok).toBe(false);
  expect(setup.store.getState().documentWorkspace).toBe(before);
  await setup.dispose();
});

it("edits canvas details and constrains owned geometry in one history transaction", async () => {
  const setup = await callbackSetup();
  const before = setup.store.getState().documentWorkspace.document!;
  expect(
    setup.actions
      .captureCanvasDetails(TEST_IDS.canvasA)!
      .complete({ name: "Smaller", settings: { width: 250, height: 250 } }),
  ).toEqual({ ok: true, changed: true });
  const after = setup.store.getState().documentWorkspace;
  expect(after.history.past).toHaveLength(1);
  expect(after.document!.canvases[TEST_IDS.canvasA].name).toBe("Smaller");
  expect(after.document!.elements[ids.card].geometry.width).toBe(
    before.elements[ids.card].geometry.width,
  );
  expect(after.document!.elements[ids.card].geometry.x).toBeLessThanOrEqual(250);
  expect(setup.actions.undo().ok).toBe(true);
  expect(setup.store.getState().documentWorkspace.document).toEqual(before);
  await setup.dispose();
});

it("rejects malformed orders and makes equal order and cancelled confirmation true no-ops", async () => {
  const setup = await callbackSetup();
  const before = setup.store.getState().documentWorkspace;
  expect(setup.actions.captureCanvasOrder()!.complete(before.document!.canvasOrder)).toEqual({
    ok: true,
    changed: false,
  });
  expect(
    setup.actions.captureCanvasOrder()!.complete([TEST_IDS.canvasA, TEST_IDS.canvasA]).ok,
  ).toBe(false);
  expect(setup.actions.captureRemoveCanvas(TEST_IDS.canvasA)!.complete(false)).toEqual({
    ok: true,
    changed: false,
  });
  expect(setup.store.getState().documentWorkspace).toBe(before);
  await setup.dispose();
});

it("creates typed roots and rejects contained creation without its placement transaction", async () => {
  const setup = await callbackSetup();
  const source = setup.store.getState().documentWorkspace.document!.elements[ids.card];
  const element = {
    ...source,
    id: asEntityId("element", "element-00000000-0000-4000-8000-000000000099"),
  };
  expect(setup.actions.captureCreateElement()!.complete(element as never).ok).toBe(false);
  expect(
    setup.actions
      .captureCreateElement()!
      .complete({ ...element, data: { ...element.data, placement: null } } as never),
  ).toEqual({ ok: true, changed: true });
  await setup.dispose();
});
