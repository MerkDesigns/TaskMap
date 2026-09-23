// @vitest-environment node
import { expect, it, vi } from "vitest";
import {
  geometryIds as ids,
  geometryInput,
  geometryLock,
} from "../commands/retainedGeometryTestSupport";
import { retainedInteractionSetup, pointer } from "./retainedInteractionTestSupport";

it("captures only eligible controller targets and preserves canonical card dimensions", async () => {
  const setup = await retainedInteractionSetup(geometryLock(geometryInput(), ids.image));
  const { interaction, store } = setup;
  const before = store.getState().documentWorkspace.document!;
  expect(interaction.beginMove(setup.moveInput([ids.card, ids.image, ids.mindmap]))).toBe(true);
  expect(interaction.getSnapshot().activeInteraction).toMatchObject({
    targetIds: [ids.card, ids.mindmap],
  });
  interaction.completePointer(pointer());
  const after = store.getState().documentWorkspace.document!;
  for (const id of [ids.card, ids.mindmap]) {
    expect(after.elements[id].geometry).toEqual({
      ...before.elements[id].geometry,
      x: before.elements[id].geometry.x + 20,
      y: before.elements[id].geometry.y + 20,
    });
    expect(after.elements[id].data).toBe(before.elements[id].data);
  }
  expect(after.elements[ids.image]).toBe(before.elements[ids.image]);
  expect(store.getState().documentWorkspace.history.past).toHaveLength(1);
  expect(setup.onCompletion).toHaveBeenCalledWith({ ok: true, changed: true });
  expect(store.workspace.undo().ok).toBe(true);
  expect(store.getState().documentWorkspace.document).toEqual(before);
  expect(store.workspace.redo().ok).toBe(true);
  await store.workspace.flushSave();
  expect(setup.client.saveDocument).toHaveBeenCalledTimes(1);
  await setup.dispose();
});

it.each([ids.container, ids.block, ids.image])(
  "completes constrained resize for %s once",
  async (id) => {
    const setup = await retainedInteractionSetup();
    const from = setup.store.getState().documentWorkspace.document!.elements[id].geometry;
    expect(
      setup.interaction.beginResize({
        pointerId: 1,
        screen: { x: 0, y: 0 },
        target: setup.target(id),
        snapTargets: [],
        constraints: {
          minimum: { width: 10, height: 10 },
          maximum: { width: from.width + 5, height: from.height + 10 },
        },
      }),
    ).toBe(true);
    setup.interaction.completePointer(pointer());
    setup.interaction.completePointer(pointer());
    expect(setup.store.getState().documentWorkspace.document!.elements[id].geometry).toEqual({
      ...from,
      width: from.width + 5,
      height: from.height + 10,
    });
    expect(setup.onCompletion).toHaveBeenCalledTimes(1);
    expect(setup.interaction.getSnapshot().geometryPreviews).toEqual([]);
    await setup.dispose();
  },
);

it("rejects locked primaries, content-sized resize, and unresolved placement before capture", async () => {
  const setup = await retainedInteractionSetup(geometryLock(geometryInput(), ids.image));
  const moveCapture = vi.spyOn(setup.actions, "captureMove");
  const resizeCapture = vi.spyOn(setup.actions, "captureResize");
  expect(setup.interaction.beginMove(setup.moveInput([ids.image, ids.card]))).toBe(false);
  expect(
    setup.interaction.beginMove({ ...setup.moveInput([ids.card]), completionBehavior: "place" }),
  ).toBe(false);
  for (const id of [ids.card, ids.mindmap, ids.image])
    expect(
      setup.interaction.beginResize({
        pointerId: 1,
        screen: { x: 0, y: 0 },
        target: setup.target(id),
        snapTargets: [],
        constraints: { minimum: { width: 10, height: 10 }, maximum: { width: 1000, height: 1000 } },
      }),
    ).toBe(false);
  expect(moveCapture).not.toHaveBeenCalled();
  expect(resizeCapture).not.toHaveBeenCalled();
  expect(setup.scheduler.size).toBe(0);
  await setup.dispose();
});

it.each(["unchanged", "threshold", "cancel", "replace", "dispose"])(
  "cancels capture on %s without dispatch",
  async (reason) => {
    const setup = await retainedInteractionSetup();
    const captured = vi.spyOn(setup.actions, "captureMove");
    const dispatch = vi.spyOn(setup.store.workspace, "dispatchCommand");
    setup.interaction.beginMove({ ...setup.moveInput([ids.card]), commitThresholdScreen: 50 });
    const handle = captured.mock.results[0].value!;
    const cancel = vi.spyOn(handle, "cancel");
    if (reason === "unchanged") setup.interaction.completePointer(pointer(0));
    if (reason === "threshold") setup.interaction.completePointer(pointer(5));
    if (reason === "cancel") setup.interaction.cancelPointer(1);
    if (reason === "replace") setup.interaction.replaceCanvas("other", setup.viewport);
    if (reason === "dispose") setup.interaction.dispose();
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(handle.complete({ operation: setup.move() })).toEqual({
      ok: false,
      code: "expired-action",
    });
    expect(dispatch).not.toHaveBeenCalled();
    expect(setup.interaction.getSnapshot().activeInteraction).toBeNull();
    await setup.dispose();
  },
);

it("does not supersede an active capture on rejected starts or unrelated pointers", async () => {
  const setup = await retainedInteractionSetup();
  const capture = vi.spyOn(setup.actions, "captureMove");
  expect(setup.interaction.beginMove(setup.moveInput([ids.card]))).toBe(true);
  expect(setup.interaction.beginMove({ ...setup.moveInput([ids.image]), pointerId: 2 })).toBe(
    false,
  );
  setup.interaction.cancelPointer(2);
  setup.interaction.completePointer(pointer(50, 2));
  expect(capture).toHaveBeenCalledTimes(1);
  setup.interaction.completePointer(pointer());
  expect(setup.onCompletion).toHaveBeenCalledWith({ ok: true, changed: true });
  await setup.dispose();
});

it("clears previews and reports stale completion failures without a second transaction", async () => {
  const setup = await retainedInteractionSetup();
  setup.interaction.beginMove(setup.moveInput([ids.card]));
  setup.actions
    .captureContent([{ elementId: ids.card, fields: ["text"] }])!
    .complete([{ elementId: ids.card, to: { text: "Unrelated" } }]);
  const from = setup.store.getState().documentWorkspace.document!.elements[ids.card].geometry;
  expect(
    setup.store.workspace.dispatchCommand({
      type: "document.element.update-geometry",
      payload: { elementId: ids.card, geometry: { ...from, x: from.x + 1 } },
    }).ok,
  ).toBe(true);
  const before = setup.store.getState().documentWorkspace;
  setup.interaction.updatePointer(pointer());
  setup.interaction.completePointer(pointer());
  expect(setup.onCompletion).toHaveBeenCalledWith({ ok: false, code: "command-failed" });
  expect(setup.store.getState().documentWorkspace).toBe(before);
  expect(setup.interaction.getSnapshot().geometryPreviews).toEqual([]);
  await setup.dispose();
});

it("routes layer ordering through the existing root-only command", async () => {
  const setup = await retainedInteractionSetup();
  setup.interaction.reorder([ids.container, ids.card], "front");
  expect(setup.onCompletion).toHaveBeenCalledWith({ ok: true, changed: true });
  expect(setup.store.getState().documentWorkspace.history.past).toHaveLength(1);
  expect(setup.store.workspace.undo().ok).toBe(true);
  await setup.dispose();
});
