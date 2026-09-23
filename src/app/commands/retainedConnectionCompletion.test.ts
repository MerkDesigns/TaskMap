// @vitest-environment node
import { expect, it, vi } from "vitest";
import { callbackSetup } from "./retainedCallbackTestSupport";
import { geometryIds as ids, geometryInput, geometryLock } from "./retainedGeometryTestSupport";
import { connectionIds, targetCompletion, nodeCompletion } from "./retainedConnectionTestSupport";
import { TEST_IDS } from "../../elements/cardContainerTestFixtures";

it.each([ids.container, ids.block, ids.image, ids.mindmap])(
  "connects retained endpoint %s without moving it or applying its lock to edges",
  async (sourceId) => {
    const setup = await callbackSetup(geometryLock(geometryInput(), sourceId));
    const before = setup.store.getState().documentWorkspace.document!;
    const target = sourceId === ids.container ? ids.block : ids.container;
    const captured = setup.actions.captureConnection(sourceId, "right")!;
    expect(captured.complete(targetCompletion(target))).toEqual({ ok: true, changed: true });
    expect(captured.complete(targetCompletion(target))).toEqual({
      ok: false,
      code: "expired-action",
    });
    const after = setup.store.getState().documentWorkspace.document!;
    expect(after.connections[connectionIds.edge]).toMatchObject({
      type: "mind-map",
      source: { elementId: sourceId, portId: "right" },
      target: { elementId: target, portId: "left" },
    });
    expect(after.elements).toBe(before.elements);
    expect(after.mediaReferences).toBe(before.mediaReferences);
    expect(setup.store.getState().documentWorkspace.history.past).toHaveLength(1);
    expect(setup.store.workspace.undo().ok).toBe(true);
    expect(setup.store.getState().documentWorkspace.document).toEqual(before);
    expect(setup.store.workspace.redo().ok).toBe(true);
    expect(setup.actions.captureConnectionDelete(connectionIds.edge)!.complete()).toEqual({
      ok: true,
      changed: true,
    });
    expect(setup.store.workspace.undo().ok).toBe(true);
    await setup.store.workspace.flushSave();
    expect(setup.client.saveDocument).toHaveBeenCalledTimes(1);
    await setup.dispose();
  },
);

it.each([
  ["left", "right"],
  ["right", "left"],
  ["top", "bottom"],
  ["bottom", "top"],
])(
  "creates a root node and opposite %s/%s edge in one transaction",
  async (sourcePort, targetPort) => {
    const setup = await callbackSetup();
    const before = setup.store.getState().documentWorkspace.document!;
    expect(
      setup.actions.captureConnection(ids.mindmap, sourcePort)!.complete(nodeCompletion()),
    ).toEqual({ ok: true, changed: true });
    const after = setup.store.getState().documentWorkspace.document!;
    expect(after.elements[connectionIds.newNode]).toEqual({
      ...nodeCompletion().newNode,
      type: "mind-map-node",
      canvasId: TEST_IDS.canvasA,
    });
    const order = after.canvases[TEST_IDS.canvasA].elementOrder;
    expect(order[order.length - 1]).toBe(connectionIds.newNode);
    expect(after.connections[connectionIds.edge].target).toEqual({
      elementId: connectionIds.newNode,
      portId: targetPort,
    });
    expect(setup.store.getState().documentWorkspace.history.past).toHaveLength(1);
    expect(setup.store.workspace.undo().ok).toBe(true);
    expect(setup.store.getState().documentWorkspace.document).toEqual(before);
    expect(setup.store.workspace.redo().ok).toBe(true);
    await setup.store.workspace.flushSave();
    expect(setup.client.saveDocument).toHaveBeenCalledTimes(1);
    await setup.dispose();
  },
);

it("keeps cancelled and null releases transient and uses the existing subscription pair", async () => {
  const setup = await callbackSetup();
  const observeStore = vi.spyOn(setup.store, "subscribe");
  const observeSession = vi.spyOn(setup.controller, "subscribe");
  const dispatch = vi.spyOn(setup.store.workspace, "dispatchCommand");
  const serialize = vi.spyOn(JSON, "stringify");
  const before = setup.store.getState().documentWorkspace;
  try {
    const cancelled = setup.actions.captureConnection(ids.mindmap, "right")!;
    cancelled.cancel();
    expect(cancelled.complete(nodeCompletion())).toEqual({ ok: false, code: "expired-action" });
    const old = setup.actions.captureConnection(ids.mindmap, "right")!;
    for (let i = 0; i < 200; i++) setup.actions.captureConnection(ids.mindmap, "right");
    expect(old.complete(targetCompletion())).toEqual({ ok: false, code: "expired-action" });
    expect(setup.actions.captureConnection(ids.mindmap, "right")!.complete(null)).toEqual({
      ok: true,
      changed: false,
    });
    expect(dispatch).not.toHaveBeenCalled();
    expect(serialize).not.toHaveBeenCalled();
    expect(observeStore).not.toHaveBeenCalled();
    expect(observeSession).not.toHaveBeenCalled();
    expect(setup.store.getState().documentWorkspace).toBe(before);
    expect(setup.scheduler.size).toBe(0);
  } finally {
    vi.restoreAllMocks();
  }
  await setup.dispose();
});

it.each(["lock", "reload", "canvas-round-trip"])(
  "revokes both connection actions after %s",
  async (reason) => {
    const setup = await callbackSetup();
    setup.actions.captureConnection(ids.mindmap, "right")!.complete(targetCompletion());
    const deletion = setup.actions.captureConnectionDelete(connectionIds.edge)!;
    const connecting = setup.actions.captureConnection(ids.mindmap, "right")!;
    if (reason === "lock") await setup.controller.lock();
    if (reason === "reload")
      setup.store.workspace.load(setup.store.getState().documentWorkspace.document!, 4);
    if (reason === "canvas-round-trip")
      for (const canvasId of [TEST_IDS.canvasB, TEST_IDS.canvasA])
        setup.store.workspace.dispatchCommand({
          type: "document.canvas.set-active",
          payload: { canvasId },
        });
    const before = setup.store.getState().documentWorkspace;
    expect(connecting.complete(nodeCompletion())).toEqual({ ok: false, code: "expired-action" });
    expect(deletion.complete()).toEqual({ ok: false, code: "expired-action" });
    expect(setup.store.getState().documentWorkspace).toBe(before);
    await setup.dispose();
  },
);

it.each(["lock", "reload", "canvas-round-trip"])(
  "revokes an unsuperseded edge deletion on %s",
  async (reason) => {
    const setup = await callbackSetup();
    setup.actions.captureConnection(ids.mindmap, "right")!.complete(targetCompletion());
    const captured = setup.actions.captureConnectionDelete(connectionIds.edge)!;
    if (reason === "lock") await setup.controller.lock();
    if (reason === "reload")
      setup.store.workspace.load(setup.store.getState().documentWorkspace.document!, 4);
    if (reason === "canvas-round-trip")
      for (const canvasId of [TEST_IDS.canvasB, TEST_IDS.canvasA])
        setup.store.workspace.dispatchCommand({
          type: "document.canvas.set-active",
          payload: { canvasId },
        });
    const before = setup.store.getState().documentWorkspace;
    expect(captured.complete()).toEqual({ ok: false, code: "expired-action" });
    expect(setup.store.getState().documentWorkspace).toBe(before);
    await setup.dispose();
  },
);
