// @vitest-environment node
import { expect, it, vi } from "vitest";
import { callbackSetup } from "./retainedCallbackTestSupport";
import { geometryIds as ids } from "./retainedGeometryTestSupport";
import { TEST_IDS } from "../../elements/cardContainerTestFixtures";
import { pointer, retainedInteractionSetup } from "../interactions/retainedInteractionTestSupport";

it.each(["undo", "redo"] as const)(
  "leaves pending edits intact when %s has no entry",
  async (direction) => {
    const setup = await callbackSetup();
    const edit = setup.actions.captureDocumentSettings(["grid.style"])!;
    const before = setup.store.getState().documentWorkspace;
    expect(setup.actions[direction]()).toEqual({ ok: true, changed: false });
    expect(setup.store.getState().documentWorkspace).toBe(before);
    expect(setup.scheduler.size).toBe(0);
    expect(edit.complete({ grid: { style: "lines" } }).ok).toBe(true);
    await setup.dispose();
  },
);

it.each(["move", "pan", "resize", "selection"])(
  "cancels unfinished %s before undo without committing pointer samples",
  async (kind) => {
    const setup = await retainedInteractionSetup();
    const before = setup.store.getState().documentWorkspace.document!;
    setup.actions.captureDocumentSettings(["grid.style"])!.complete({ grid: { style: "lines" } });
    if (kind === "move")
      expect(setup.interaction.beginMove(setup.moveInput([ids.card]))).toBe(true);
    else if (kind === "resize")
      expect(
        setup.interaction.beginResize({
          pointerId: 1,
          screen: { x: 0, y: 0 },
          target: setup.target(ids.image),
          snapTargets: [],
          constraints: {
            minimum: { width: 10, height: 10 },
            maximum: { width: 1000, height: 1000 },
          },
        }),
      ).toBe(true);
    else if (kind === "selection")
      expect(
        setup.interaction.beginSelection({
          pointerId: 1,
          screen: { x: 0, y: 0 },
          additive: false,
          candidates: [setup.target(ids.card)],
        }),
      ).toBe(true);
    else expect(setup.interaction.beginPan(1, { x: 0, y: 0 })).toBe(true);
    setup.interaction.updatePointer(pointer());
    expect(setup.interaction.getSnapshot().activeInteraction).not.toBeNull();
    const serialize = vi.spyOn(JSON, "stringify");
    try {
      expect(setup.actions.undo()).toEqual({ ok: true, changed: true });
      expect(setup.interaction.getSnapshot().activeInteraction).toBeNull();
      expect(setup.interaction.getSnapshot()).toMatchObject({
        selectedIds: [],
        geometryPreviews: [],
        selectionRectangle: null,
        viewport: setup.viewport,
      });
      const after = setup.store.getState().documentWorkspace;
      expect(after.document).toEqual(before);
      expect(after.history.past).toHaveLength(0);
      expect(after.history.future).toHaveLength(1);
      setup.interaction.completePointer(pointer(90));
      expect(setup.store.getState().documentWorkspace).toBe(after);
      expect(setup.onCompletion).not.toHaveBeenCalled();
      expect(serialize).not.toHaveBeenCalled();
      expect(setup.client.saveDocument).not.toHaveBeenCalled();
      expect(setup.actions.redo()).toEqual({ ok: true, changed: true });
    } finally {
      serialize.mockRestore();
    }
    await setup.dispose();
  },
);

it("expires old captures even when undo restores their original preconditions", async () => {
  const setup = await callbackSetup();
  const edit = setup.actions.captureDocumentSettings(["grid.style"])!;
  setup.store.workspace.dispatchCommand({
    type: "document.settings.update",
    payload: { settings: { grid: { style: "lines" } } },
  });
  expect(setup.actions.undo().ok).toBe(true);
  expect(edit.complete({ grid: { style: "lines" } })).toEqual({
    ok: false,
    code: "expired-action",
  });
  expect(setup.store.getState().documentWorkspace.history.future).toHaveLength(1);
  await setup.dispose();
});

it.each(["invalidation", "dispatch"])(
  "blocks reentrant history/captures during %s notification",
  async (stage) => {
    const setup = await callbackSetup();
    setup.actions.captureDocumentSettings(["grid.style"])!.complete({ grid: { style: "lines" } });
    const listener = vi.fn(() => {
      expect(setup.actions.undo()).toEqual({ ok: false, code: "expired-action" });
      expect(setup.actions.redo()).toEqual({ ok: false, code: "expired-action" });
      expect(setup.actions.captureDocumentSettings(["grid.style"])).toBeNull();
      expect(setup.actions.captureDelete([ids.card])).toBeNull();
    });
    const unsubscribe =
      stage === "invalidation"
        ? setup.actions.subscribeInvalidation(listener)
        : setup.store.subscribe(listener);
    expect(setup.actions.undo()).toEqual({ ok: true, changed: true });
    expect(listener).toHaveBeenCalled();
    expect(setup.store.getState().documentWorkspace.history.future).toHaveLength(1);
    unsubscribe();
    await setup.dispose();
  },
);

it.each(["reload", "canvas", "dispose", "throw"])(
  "does not apply history after invalidation listener %s",
  async (action) => {
    const setup = await callbackSetup();
    setup.actions.captureDocumentSettings(["grid.style"])!.complete({ grid: { style: "lines" } });
    const undo = vi.spyOn(setup.store.workspace, "undo");
    const unsubscribe = setup.actions.subscribeInvalidation(() => {
      unsubscribe();
      if (action === "reload")
        setup.store.workspace.load(setup.store.getState().documentWorkspace.document!, 4);
      if (action === "canvas")
        setup.store.workspace.dispatchCommand({
          type: "document.canvas.set-active",
          payload: { canvasId: TEST_IDS.canvasB },
        });
      if (action === "dispose") setup.actions.dispose();
      if (action === "throw") throw new Error("test failure");
    });
    expect(setup.actions.undo()).toEqual({
      ok: false,
      code: action === "throw" ? "history-failed" : "expired-action",
    });
    expect(undo).not.toHaveBeenCalled();
    expect(setup.store.getState().documentWorkspace.document!.documentSettings.grid.style).toBe(
      "lines",
    );
    undo.mockRestore();
    await setup.dispose();
  },
);

it("keeps history failures atomic and sanitizes them while expiring old callbacks", async () => {
  const setup = await callbackSetup();
  setup.actions.captureDocumentSettings(["grid.style"])!.complete({ grid: { style: "lines" } });
  const edit = setup.actions.captureDocumentSettings(["grid.style"])!;
  const before = setup.store.getState().documentWorkspace;
  const undo = vi.spyOn(setup.store.workspace, "undo").mockImplementation(() => {
    throw new Error("test-only diagnostic");
  });
  expect(setup.actions.undo()).toEqual({ ok: false, code: "history-failed" });
  expect(setup.store.getState().documentWorkspace).toBe(before);
  expect(edit.complete(null)).toEqual({ ok: false, code: "expired-action" });
  undo.mockRestore();
  expect(setup.actions.undo().ok).toBe(true);
  await setup.dispose();
});

it("rejects history while locked or disposed", async () => {
  const setup = await callbackSetup();
  await setup.controller.lock();
  expect(setup.actions.undo()).toEqual({ ok: false, code: "expired-action" });
  expect(setup.actions.redo()).toEqual({ ok: false, code: "expired-action" });
  setup.actions.dispose();
  expect(setup.actions.undo()).toEqual({ ok: false, code: "expired-action" });
  await setup.dispose();
});

it("revokes pending edits on redo and saves only through the existing debounce", async () => {
  const setup = await callbackSetup();
  setup.actions.captureDocumentSettings(["grid.style"])!.complete({ grid: { style: "lines" } });
  setup.actions.undo();
  const edit = setup.actions.captureDocumentSettings(["grid.style"])!;
  expect(setup.actions.redo()).toEqual({ ok: true, changed: true });
  expect(edit.complete(null)).toEqual({ ok: false, code: "expired-action" });
  expect(setup.store.getState().documentWorkspace.localChangeSequence).toBe(3);
  expect(setup.store.getState().documentWorkspace.history.past).toHaveLength(1);
  expect(setup.scheduler.size).toBe(1);
  expect(setup.client.saveDocument).not.toHaveBeenCalled();
  await setup.store.workspace.flushSave();
  expect(setup.client.saveDocument).toHaveBeenCalledTimes(1);
  await setup.dispose();
});

it("uses document transaction history without recording or reverting canvas navigation", async () => {
  const setup = await callbackSetup();
  setup.actions.captureMove(ids.card, [ids.card])!.complete({ operation: setup.move() });
  setup.store.workspace.dispatchCommand({
    type: "document.canvas.set-active",
    payload: { canvasId: TEST_IDS.canvasB },
  });
  expect(setup.store.getState().documentWorkspace.history.past).toHaveLength(1);
  expect(setup.actions.undo()).toEqual({ ok: true, changed: true });
  expect(setup.store.getState().documentWorkspace.document!.activeCanvasId).toBe(TEST_IDS.canvasB);
  expect(setup.store.getState().documentWorkspace.document!.elements[ids.card].geometry.x).toBe(
    300,
  );
  await setup.dispose();
});

it("returns sanitized failure for a rejected history candidate", async () => {
  const setup = await callbackSetup();
  setup.actions.captureDocumentSettings(["grid.style"])!.complete({ grid: { style: "lines" } });
  const before = setup.store.getState().documentWorkspace;
  const undo = vi
    .spyOn(setup.store.workspace, "undo")
    .mockReturnValue({ ok: false, code: "history-failed", issues: [] });
  expect(setup.actions.undo()).toEqual({ ok: false, code: "history-failed" });
  expect(setup.store.getState().documentWorkspace).toBe(before);
  undo.mockRestore();
  await setup.dispose();
});
