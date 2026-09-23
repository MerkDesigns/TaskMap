// @vitest-environment node
import { expect, it, vi } from "vitest";
import { retainedDropSetup, dropInput, dropIds as ids } from "./retainedDropTestSupport";
import { geometryLock } from "../../app/commands/retainedGeometryTestSupport";
import { containerPlacementSchema } from "../../domain/document/elementPlacement";
import { TEST_IDS } from "../../elements/cardContainerTestFixtures";

it.each([false, true])(
  "maps real filtered/scrolled drops and detach, including nonprimary offsets (root=%s)",
  async (root) => {
    const setup = await retainedDropSetup();
    const before = setup.store.getState().documentWorkspace.document!;
    expect(setup.begin()).toBe(true);
    const sample = root ? setup.update(1000, 600) : setup.update(530, 100);
    const decision = setup.placement.getDecision()!;
    expect(decision).toMatchObject(
      root
        ? { targetContainerId: null, realIndex: null }
        : { targetContainerId: ids.target, visibleIndex: 1, realIndex: 1 },
    );
    expect(decision.draggedIds).toEqual([ids.card, ids.bundle]);
    const resolve = vi.spyOn(setup.placement, "getDecision");
    setup.interaction.completePointer(sample);
    setup.interaction.completePointer(sample);
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(setup.onCompletion).toHaveBeenCalledWith({ ok: true, changed: true });
    const after = setup.store.getState().documentWorkspace.document!;
    for (const position of decision.loosePositions) {
      const id = position.id as typeof ids.card;
      expect(after.elements[id].geometry).toEqual({
        ...before.elements[id].geometry,
        x: position.x,
        y: position.y,
      });
      expect(after.elements[id].data.placement).toEqual(
        root ? null : { containerId: ids.target, order: id === ids.card ? 2 : 3 },
      );
    }
    if (!root) {
      const targetIds = Object.values(after.elements)
        .filter((element) => {
          const placement = containerPlacementSchema.safeParse(element.data.placement);
          return placement.success && placement.data?.containerId === ids.target;
        })
        .sort(
          (a, b) =>
            containerPlacementSchema.parse(a.data.placement)!.order -
            containerPlacementSchema.parse(b.data.placement)!.order,
        )
        .map((item) => item.id);
      expect(targetIds).toEqual([
        ids.image,
        ids.sibling,
        ids.card,
        ids.bundle,
        ids.hidden,
        ids.trailingImage,
      ]);
    }
    expect(after.mediaReferences).toBe(before.mediaReferences);
    expect(after.canvases[TEST_IDS.canvasA].elementOrder).toBe(
      before.canvases[TEST_IDS.canvasA].elementOrder,
    );
    expect(setup.store.getState().documentWorkspace.history.past).toHaveLength(1);
    expect(setup.interaction.getSnapshot().geometryPreviews).toEqual([]);
    expect(setup.store.workspace.undo().ok).toBe(true);
    expect(setup.store.getState().documentWorkspace.document).toEqual(before);
    expect(setup.store.workspace.redo().ok).toBe(true);
    await setup.store.workspace.flushSave();
    expect(setup.client.saveDocument).toHaveBeenCalledTimes(1);
    await setup.dispose();
  },
);

it("uses actual drop hit-testing when a text block covers the target", async () => {
  const input = dropInput();
  input.elements[ids.block].geometry = { x: 500, y: 90, width: 200, height: 100 };
  const setup = await retainedDropSetup(input);
  setup.begin();
  const sample = setup.update(530, 100);
  expect(setup.placement.getDecision()?.targetContainerId).toBeNull();
  setup.interaction.completePointer(sample);
  expect(
    setup.store.getState().documentWorkspace.document!.elements[ids.card].data.placement,
  ).toBeNull();
  await setup.dispose();
});

it("allows a locked destination but filters locked bundle members before capture", async () => {
  const setup = await retainedDropSetup(geometryLock(dropInput(), ids.card));
  expect(setup.begin()).toBe(true);
  expect(setup.interaction.getSnapshot().activeInteraction).toMatchObject({
    targetIds: [ids.bundle],
  });
  const sample = setup.update(530, 100);
  setup.interaction.completePointer(sample);
  expect(setup.onCompletion).toHaveBeenCalledWith({ ok: true, changed: true });
  expect(
    setup.store.getState().documentWorkspace.document!.elements[ids.card].data.placement,
  ).toEqual({ containerId: ids.container, order: 0 });
  await setup.dispose();
  const targetLocked = await retainedDropSetup(geometryLock(dropInput(), ids.target));
  targetLocked.begin();
  targetLocked.interaction.completePointer(targetLocked.update(530, 100));
  expect(targetLocked.onCompletion).toHaveBeenCalledWith({ ok: true, changed: true });
  await targetLocked.dispose();
});

it.each(["cancel", "lock", "short", "stale-sibling"])(
  "does not persist a %s drop",
  async (reason) => {
    const setup = await retainedDropSetup();
    setup.begin();
    const sample = setup.update(530, 100);
    const resolve = vi.spyOn(setup.placement, "getDecision");
    if (reason === "cancel") setup.interaction.cancelPointer(1);
    if (reason === "lock") await setup.controller.lock();
    if (reason === "stale-sibling") setup.actions.captureDelete([ids.trailingImage])!.complete();
    const before = setup.store.getState().documentWorkspace;
    if (reason === "short") {
      const bounds = setup.plan.targets.find((item) => item.id === ids.bundle)!.geometry;
      setup.interaction.completePointer({
        ...sample,
        screen: { x: bounds.x + 1, y: bounds.y + 10 },
      });
    } else setup.interaction.completePointer(sample);
    expect(setup.store.getState().documentWorkspace).toBe(before);
    expect(setup.interaction.getSnapshot().geometryPreviews).toEqual([]);
    expect(resolve).toHaveBeenCalledTimes(reason === "stale-sibling" ? 1 : 0);
    if (reason === "stale-sibling")
      expect(setup.onCompletion).toHaveBeenCalledWith({ ok: false, code: "command-failed" });
    else expect(setup.onCompletion).not.toHaveBeenCalled();
    await setup.dispose();
  },
);

it("keeps 200 real placement previews off the document/serialization path", async () => {
  const setup = await retainedDropSetup();
  setup.begin();
  const before = setup.store.getState().documentWorkspace;
  const read = vi.spyOn(setup.store, "getState");
  const lifecycle = vi.spyOn(setup.controller, "getSnapshot");
  const serialize = vi.spyOn(JSON, "stringify");
  const dispatch = vi.spyOn(setup.store.workspace, "dispatchCommand");
  const resolve = vi.spyOn(setup.placement, "getDecision");
  try {
    for (let i = 0; i < 200; i++) setup.update(530, 100 + i / 1000);
    expect(read).not.toHaveBeenCalled();
    expect(lifecycle).not.toHaveBeenCalled();
    expect(serialize).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
    expect(resolve).not.toHaveBeenCalled();
    expect(setup.store.getState().documentWorkspace).toBe(before);
    expect(setup.scheduler.size).toBe(0);
    setup.interaction.completePointer({
      pointerId: 1,
      screen: { x: 530, y: 100.199 },
      snapping: false,
    });
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(serialize).not.toHaveBeenCalled();
    expect(setup.onCompletion).toHaveBeenCalledWith({ ok: true, changed: true });
  } finally {
    vi.restoreAllMocks();
  }
  await setup.dispose();
});

it("keeps the existing topmost-container and directional insertion behavior", async () => {
  const input = dropInput();
  input.elements[ids.container].geometry.x = 500;
  const setup = await retainedDropSetup(input, ids.bundle, {});
  setup.begin();
  setup.update(530, 140);
  expect(setup.placement.getDecision()).toMatchObject({
    targetContainerId: ids.target,
    visibleIndex: 1,
  });
  setup.update(530, 100);
  expect(setup.placement.getDecision()?.visibleIndex).toBe(0);
  const sample = setup.update(530, 99);
  expect(setup.placement.getDecision()?.visibleIndex).toBe(0);
  setup.interaction.completePointer(sample);
  expect(setup.onCompletion).toHaveBeenCalledWith({ ok: true, changed: true });
  expect(
    setup.store.getState().documentWorkspace.document!.elements[ids.card].data.placement,
  ).toEqual({ containerId: ids.target, order: 1 });
  await setup.dispose();
});

it.each(["missing", "exception"])(
  "clears previews and reports a %s placement result without a write",
  async (reason) => {
    const setup = await retainedDropSetup();
    setup.begin();
    const sample = setup.update(530, 100);
    vi.spyOn(setup.placement, "getDecision").mockImplementation(() => {
      if (reason === "exception") throw new Error("Test resolver failure");
      return null;
    });
    const before = setup.store.getState().documentWorkspace;
    setup.interaction.completePointer(sample);
    expect(setup.onCompletion).toHaveBeenCalledWith({ ok: false, code: "invalid-action" });
    expect(setup.store.getState().documentWorkspace).toBe(before);
    expect(setup.interaction.getSnapshot().geometryPreviews).toEqual([]);
    expect(setup.scheduler.size).toBe(0);
    await setup.dispose();
  },
);
