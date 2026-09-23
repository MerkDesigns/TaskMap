import { describe, expect, it, vi } from "vitest";
import { TEST_IDS } from "../../elements/cardContainerTestFixtures";
import { geometryIds } from "../commands/retainedGeometryTestSupport";
import { pointer } from "../interactions/retainedInteractionTestSupport";
import { createRetainedCanvasBinding } from "./createRetainedCanvasBinding";
import { canvasBindingSetup } from "./retainedCanvasBindingTestSupport";

describe("session-bound retained canvas", () => {
  it("projects completed edits and undo without replacing the gesture controller", async () => {
    const setup = await canvasBindingSetup();
    try {
      const { binding, actions } = setup;
      const controller = binding.interaction;
      const original = binding.getSnapshot();
      expect(original).toMatchObject({ phase: "ready", activeCanvas: { id: TEST_IDS.canvasA } });
      const capture = actions.captureContent([{ elementId: geometryIds.card, fields: ["text"] }]);
      expect(
        capture?.complete([{ elementId: geometryIds.card, to: { text: "Edited card" } }]).ok,
      ).toBe(true);
      const edited = binding.getSnapshot();
      if (edited.phase !== "ready") throw new Error("Expected ready view");
      expect(edited.activeCanvas?.textCards.find(({ id }) => id === geometryIds.card)?.text).toBe(
        "Edited card",
      );
      expect(binding.interaction).toBe(controller);
      expect(actions.undo().ok).toBe(true);
      const undone = binding.getSnapshot();
      if (undone.phase !== "ready" || original.phase !== "ready") throw new Error("Expected views");
      expect(undone.activeCanvas?.textCards).toEqual(original.activeCanvas?.textCards);
    } finally {
      await setup.dispose();
    }
  });

  it("restores each settled camera with the current viewport extent on canvas switches", async () => {
    const setup = await canvasBindingSetup();
    try {
      const { binding, views, actions } = setup;
      const controller = binding.interaction;
      controller.beginPan(1, { x: 0, y: 0 });
      controller.completePointer(pointer(40));
      controller.resizeViewport({ width: 700, height: 500 });
      expect(actions.switchCanvas(TEST_IDS.canvasB).ok).toBe(true);
      expect(controller.getSnapshot().viewport).toEqual({
        pan: { x: 0, y: 0 },
        zoom: 1,
        screen: { width: 700, height: 500 },
      });
      controller.beginPan(1, { x: 0, y: 0 });
      controller.completePointer(pointer(80));
      expect(actions.switchCanvas(TEST_IDS.canvasA).ok).toBe(true);
      expect(controller.getSnapshot().viewport.pan).toEqual({ x: 40, y: 40 });
      expect(controller.getSnapshot().viewport.screen).toEqual({ width: 700, height: 500 });
      expect(views.get(TEST_IDS.canvasB)?.pan).toEqual({ x: 80, y: 80 });
      expect(binding.getSnapshot()).toMatchObject({ activeCanvas: { id: TEST_IDS.canvasA } });
    } finally {
      await setup.dispose();
    }
  });

  it("keeps the view and camera available after an ordinary save failure", async () => {
    const setup = await canvasBindingSetup();
    try {
      const before = setup.binding.getSnapshot();
      setup.actions.captureCanvasEdit(TEST_IDS.canvasA, "name")?.complete("Unsaved canvas");
      setup.client.saveDocument.mockResolvedValue({
        ok: false,
        error: { code: "save_failure", message: "Cannot save", retryable: true },
      });
      const closing = setup.controller.lock();
      expect(setup.binding.getSnapshot()).toMatchObject({ phase: "ready", editable: false });
      expect((await closing).ok).toBe(false);
      expect(setup.binding.getSnapshot()).toMatchObject({
        phase: "ready",
        editable: true,
        activeCanvas: { name: "Unsaved canvas" },
      });
      expect(setup.binding.getSnapshot()).not.toBe(before);
      expect(setup.onRevoke).not.toHaveBeenCalled();
    } finally {
      await setup.dispose();
    }
  });

  it.each(["cancel", "lock", "replacement", "dispose"] as const)(
    "permanently revokes projection, selection and queued pointer work on %s",
    async (reason) => {
      const setup = await canvasBindingSetup();
      try {
        const { binding, store, controller } = setup;
        binding.interaction.setSelection([geometryIds.card]);
        binding.interaction.beginPan(1, { x: 0, y: 0 });
        binding.interaction.updatePointer(pointer(20));
        if (reason === "replacement")
          store.workspace.load(store.getState().documentWorkspace.document!, 4);
        else if (reason === "dispose") binding.dispose();
        else await controller[reason]();
        expect(binding.getSnapshot()).toEqual({ phase: "revoked" });
        expect(binding.interaction.getSnapshot()).toMatchObject({
          canvasKey: "",
          selectedIds: [],
          activeInteraction: null,
        });
        const after = store.getState().documentWorkspace;
        binding.interaction.completePointer(pointer(100));
        expect(binding.interaction.beginPan(2, { x: 0, y: 0 })).toBe(false);
        expect(store.getState().documentWorkspace).toBe(after);
        binding.clear();
        expect(setup.onRevoke).toHaveBeenCalledTimes(1);
      } finally {
        await setup.dispose();
      }
    },
  );

  it("rejects binding before remembered views are ready or while the session transitions", async () => {
    const setup = await canvasBindingSetup();
    try {
      const pending = setup.controller.prepareWindowClose();
      expect(() => createRetainedCanvasBinding(setup.options)).toThrow("admitted session");
      await pending;
      setup.views.clear();
      expect(() => createRetainedCanvasBinding(setup.options)).toThrow("initialized resources");
    } finally {
      await setup.dispose();
    }
  });

  it("does not resurrect a view if a camera observer cancels during canvas replacement", async () => {
    const setup = await canvasBindingSetup();
    try {
      setup.binding.interaction.subscribe(() => {
        if (setup.binding.interaction.getSnapshot().canvasKey === TEST_IDS.canvasB)
          void setup.controller.cancel();
      });
      setup.actions.switchCanvas(TEST_IDS.canvasB);
      expect(setup.binding.getSnapshot()).toEqual({ phase: "revoked" });
      expect(setup.onRevoke).toHaveBeenCalledTimes(1);
      await setup.controller.cancel();
    } finally {
      await setup.dispose();
    }
  });

  it("notifies all observers after cleanup even when a view observer throws", async () => {
    const setup = await canvasBindingSetup();
    try {
      const observed = vi.fn(() =>
        expect(setup.binding.getSnapshot()).toEqual({ phase: "revoked" }),
      );
      setup.binding.subscribe(() => {
        throw new Error("Observer failure");
      });
      setup.binding.subscribe(observed);
      setup.binding.clear();
      expect(observed).toHaveBeenCalledOnce();
    } finally {
      await setup.dispose();
    }
  });

  it("retries failed UI cleanup without reviving the revoked binding", async () => {
    const setup = await canvasBindingSetup();
    try {
      setup.onRevoke.mockImplementationOnce(() => {
        throw new Error("Purge failed");
      });
      expect(() => setup.binding.clear()).toThrow("Purge failed");
      expect(setup.binding.getSnapshot()).toEqual({ phase: "revoked" });
      expect(() => setup.binding.clear()).not.toThrow();
      setup.binding.clear();
      expect(setup.onRevoke).toHaveBeenCalledTimes(2);
    } finally {
      await setup.dispose();
    }
  });

  it("disposes the controller even if an interaction observer throws during revocation", async () => {
    const setup = await canvasBindingSetup();
    try {
      const observer = vi.fn(() => {
        throw new Error("Interaction observer failed");
      });
      setup.binding.interaction.subscribe(observer);
      expect(() => setup.binding.clear()).toThrow("Interaction observer failed");
      expect(setup.binding.getSnapshot()).toEqual({ phase: "revoked" });
      setup.binding.interaction.resizeViewport({ width: 10, height: 10 });
      expect(observer).toHaveBeenCalledOnce();
      expect(setup.onRevoke).toHaveBeenCalledOnce();
    } finally {
      await setup.dispose();
    }
  });
});
