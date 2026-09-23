// @vitest-environment node
import { expect, it, vi } from "vitest";
import { geometryIds as ids } from "../commands/retainedGeometryTestSupport";
import { TEST_IDS } from "../../elements/cardContainerTestFixtures";
import { retainedInteractionSetup, pointer } from "./retainedInteractionTestSupport";

it.each(["clear", "dispose-actions", "reload", "canvas-round-trip", "lock"])(
  "revokes controller state on %s",
  async (reason) => {
    const setup = await retainedInteractionSetup();
    const { interaction, store } = setup;
    interaction.setSelection([ids.card]);
    interaction.beginMove(setup.moveInput([ids.card]));
    interaction.updatePointer(pointer());
    expect(interaction.getSnapshot().geometryPreviews).toHaveLength(1);
    if (reason === "clear") setup.actions.clear();
    if (reason === "dispose-actions") setup.actions.dispose();
    if (reason === "reload") store.workspace.load(store.getState().documentWorkspace.document!, 4);
    if (reason === "canvas-round-trip")
      for (const canvasId of [TEST_IDS.canvasB, TEST_IDS.canvasA])
        expect(
          store.workspace.dispatchCommand({
            type: "document.canvas.set-active",
            payload: { canvasId },
          }).ok,
        ).toBe(true);
    if (reason === "lock") {
      const locking = setup.controller.lock();
      expect(interaction.getSnapshot().geometryPreviews).toEqual([]);
      expect((await locking).ok).toBe(true);
      expect(interaction.beginPan(2, { x: 0, y: 0 })).toBe(false);
    }
    expect(interaction.getSnapshot()).toMatchObject({
      activeInteraction: null,
      selectedIds: [],
      geometryPreviews: [],
      snapGuides: [],
      selectionRectangle: null,
    });
    const before = store.getState().documentWorkspace;
    interaction.completePointer(pointer());
    expect(store.getState().documentWorkspace).toBe(before);
    expect(setup.onCompletion).not.toHaveBeenCalled();
    expect(setup.client.saveDocument).not.toHaveBeenCalled();
    await setup.dispose();
  },
);

it("cancels selection and pan on invalidation, restoring the pre-pan viewport", async () => {
  const setup = await retainedInteractionSetup();
  const { interaction } = setup;
  interaction.beginSelection({
    pointerId: 1,
    screen: { x: 0, y: 0 },
    additive: false,
    candidates: [setup.target(ids.card)],
  });
  interaction.updatePointer(pointer(1000));
  setup.actions.clear();
  expect(interaction.getSnapshot().selectionRectangle).toBeNull();
  expect(interaction.getSnapshot().selectionPreviewIds).toEqual([]);
  interaction.beginPan(1, { x: 0, y: 0 });
  interaction.updatePointer(pointer(100));
  setup.actions.clear();
  expect(interaction.getSnapshot().activeInteraction).toBeNull();
  expect(interaction.getSnapshot().viewport).toEqual(setup.viewport);
  await setup.dispose();
});

it("requires matching canvas identity, including after switching the document canvas", async () => {
  const setup = await retainedInteractionSetup();
  setup.interaction.replaceCanvas("wrong", setup.viewport);
  expect(setup.interaction.beginMove(setup.moveInput([ids.card]))).toBe(false);
  expect(setup.interaction.beginPan(1, { x: 0, y: 0 })).toBe(false);
  setup.interaction.reorder([ids.container], "front");
  expect(setup.scheduler.size).toBe(0);
  setup.interaction.replaceCanvas(TEST_IDS.canvasA, setup.viewport);
  expect(setup.interaction.beginMove(setup.moveInput([ids.card]))).toBe(true);
  setup.store.workspace.dispatchCommand({
    type: "document.canvas.set-active",
    payload: { canvasId: TEST_IDS.canvasB },
  });
  expect(setup.interaction.beginPan(1, { x: 0, y: 0 })).toBe(false);
  setup.interaction.replaceCanvas(TEST_IDS.canvasB, setup.viewport);
  expect(setup.interaction.beginPan(1, { x: 0, y: 0 })).toBe(true);
  await setup.dispose();
});

it("does not let reentrant preview listeners revive a gesture during invalidation or completion", async () => {
  const setup = await retainedInteractionSetup();
  const input = setup.moveInput([ids.card]);
  setup.interaction.beginMove(input);
  const reenter = vi.fn(() => {
    if (!setup.interaction.getSnapshot().activeInteraction)
      expect(setup.interaction.beginMove(input)).toBe(false);
  });
  const stop = setup.interaction.subscribe(reenter);
  setup.actions.clear();
  stop();
  expect(reenter).toHaveBeenCalled();
  expect(setup.interaction.beginMove(input)).toBe(true);
  const stopAgain = setup.interaction.subscribe(reenter);
  setup.interaction.completePointer(pointer());
  stopAgain();
  expect(setup.onCompletion).toHaveBeenCalledWith({ ok: true, changed: true });
  await setup.dispose();
});

it("does not leave an active controller gesture when canonical capture fails", async () => {
  const setup = await retainedInteractionSetup();
  vi.spyOn(setup.actions, "captureMove").mockReturnValue(null);
  expect(setup.interaction.beginMove(setup.moveInput([ids.card]))).toBe(false);
  expect(setup.interaction.getSnapshot().activeInteraction).toBeNull();
  expect(setup.scheduler.size).toBe(0);
  await setup.dispose();
});

it("unsubscribes invalidation and purges its readable snapshot when disposed", async () => {
  const setup = await retainedInteractionSetup();
  setup.interaction.setSelection([ids.card]);
  setup.interaction.beginMove(setup.moveInput([ids.card]));
  setup.interaction.updatePointer(pointer());
  setup.interaction.dispose();
  const after = setup.interaction.getSnapshot();
  expect(after).toMatchObject({
    canvasKey: "",
    activeInteraction: null,
    selectedIds: [],
    geometryPreviews: [],
  });
  setup.actions.clear();
  setup.actions.dispose();
  expect(setup.interaction.getSnapshot()).toBe(after);
  expect(setup.interaction.beginPan(1, { x: 0, y: 0 })).toBe(false);
  await setup.dispose();
});

it("keeps failed save-before-lock previews revoked after returning to an editable session", async () => {
  const setup = await retainedInteractionSetup();
  setup.actions
    .captureContent([{ elementId: ids.card, fields: ["text"] }])!
    .complete([{ elementId: ids.card, to: { text: "Unsaved edit" } }]);
  setup.interaction.beginMove(setup.moveInput([ids.card]));
  setup.interaction.updatePointer(pointer());
  setup.client.saveDocument.mockResolvedValue({
    ok: false,
    error: { code: "save_failure", message: "Test failure", retryable: true },
  });
  expect((await setup.controller.lock()).ok).toBe(false);
  expect(setup.controller.getSnapshot()).toMatchObject({ phase: "unlocked", busy: false });
  const before = setup.store.getState().documentWorkspace;
  setup.interaction.completePointer(pointer());
  expect(setup.interaction.getSnapshot().geometryPreviews).toEqual([]);
  expect(setup.store.getState().documentWorkspace).toBe(before);
  expect(setup.onCompletion).not.toHaveBeenCalled();
  expect(setup.interaction.beginMove(setup.moveInput([ids.card]))).toBe(true);
  await setup.dispose();
});

it("notifies identity invalidation without reacting to ordinary edits or retaining unsubscribed listeners", async () => {
  const setup = await retainedInteractionSetup();
  const invalidated = vi.fn(() => {
    setup.actions.canInteract(TEST_IDS.canvasA);
  });
  const stop = setup.actions.subscribeInvalidation(invalidated);
  setup.actions
    .captureContent([{ elementId: ids.card, fields: ["text"] }])!
    .complete([{ elementId: ids.card, to: { text: "Ordinary edit" } }]);
  expect(invalidated).not.toHaveBeenCalled();
  setup.store.workspace.load(setup.store.getState().documentWorkspace.document!, 4);
  expect(invalidated).toHaveBeenCalledTimes(1);
  setup.actions.clear();
  expect(invalidated).toHaveBeenCalledTimes(2);
  stop();
  setup.actions.dispose();
  expect(invalidated).toHaveBeenCalledTimes(2);
  await setup.dispose();
});
