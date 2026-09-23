// @vitest-environment node
import { expect, it, vi } from "vitest";
import { geometryIds as ids } from "../commands/retainedGeometryTestSupport";
import { retainedInteractionSetup, pointer } from "./retainedInteractionTestSupport";

it.each(["move", "resize", "pan"])(
  "keeps 200 %s samples entirely transient with no extra subscriptions",
  async (kind) => {
    const setup = await retainedInteractionSetup();
    const subscribeStore = vi.spyOn(setup.store, "subscribe");
    const subscribeSession = vi.spyOn(setup.controller, "subscribe");
    const { interaction } = setup;
    if (kind === "move") interaction.beginMove(setup.moveInput([ids.card, ids.image]));
    if (kind === "resize")
      interaction.beginResize({
        pointerId: 1,
        screen: { x: 0, y: 0 },
        target: setup.target(ids.image),
        snapTargets: [],
        constraints: { minimum: { width: 10, height: 10 }, maximum: { width: 5000, height: 5000 } },
      });
    if (kind === "pan") interaction.beginPan(1, { x: 0, y: 0 });
    const before = setup.store.getState().documentWorkspace;
    const read = vi.spyOn(setup.store, "getState");
    const lifecycle = vi.spyOn(setup.controller, "getSnapshot");
    const dispatch = vi.spyOn(setup.store.workspace, "dispatchCommand");
    const stringify = vi.spyOn(JSON, "stringify");
    try {
      for (let frame = 1; frame <= 200; frame++) interaction.updatePointer(pointer(frame));
      expect(read).not.toHaveBeenCalled();
      expect(lifecycle).not.toHaveBeenCalled();
      expect(dispatch).not.toHaveBeenCalled();
      expect(stringify).not.toHaveBeenCalled();
      expect(subscribeStore).not.toHaveBeenCalled();
      expect(subscribeSession).not.toHaveBeenCalled();
      expect(setup.store.getState().documentWorkspace).toBe(before);
      expect(setup.scheduler.size).toBe(0);
      interaction.completePointer(pointer(200));
      expect(dispatch).toHaveBeenCalledTimes(kind === "pan" ? 0 : 1);
      expect(setup.store.getState().documentWorkspace.history.past).toHaveLength(
        kind === "pan" ? 0 : 1,
      );
      expect(stringify).not.toHaveBeenCalled();
    } finally {
      vi.restoreAllMocks();
    }
    await setup.store.workspace.flushSave();
    expect(setup.client.saveDocument).toHaveBeenCalledTimes(kind === "pan" ? 0 : 1);
    await setup.dispose();
  },
);
