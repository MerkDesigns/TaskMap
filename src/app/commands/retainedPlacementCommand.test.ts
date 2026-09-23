// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  placementCommand,
  placementIds as ids,
  placementInput,
  placementSetup,
} from "./retainedPlacementTestSupport";
import { geometryLock } from "./retainedGeometryTestSupport";
import { TEST_IDS } from "../../elements/cardContainerTestFixtures";

describe("atomic retained placement", () => {
  it("reparents a caller-ordered mixed bundle with geometry, sibling orders and one undo/save", async () => {
    const { store, scheduler, saveDocument } = placementSetup();
    const before = store.getState().documentWorkspace.document!;
    const command = placementCommand(before, [ids.image, ids.card]);
    command.payload.updates.forEach(({ to }) => {
      to.x += 40;
      to.y += 20;
    });
    const from = before.elements[ids.block].geometry;
    command.payload.updates.push({ elementId: ids.block, from, to: { ...from, x: 456 } });
    expect(store.workspace.dispatchCommand(command)).toMatchObject({ ok: true, changed: true });
    const after = store.getState().documentWorkspace.document!;
    for (const [order, id] of [ids.image, ids.card, ids.sibling].entries()) {
      expect(after.elements[id].data.placement).toEqual({ containerId: ids.target, order });
    }
    expect(after.elements[ids.card].geometry).toEqual({
      ...before.elements[ids.card].geometry,
      x: 340,
      y: 40,
    });
    expect(after.elements[ids.block].geometry.x).toBe(456);
    expect(after.elements[ids.sibling].geometry).toBe(before.elements[ids.sibling].geometry);
    expect(after.canvases).toBe(before.canvases);
    expect(after.mediaReferences).toBe(before.mediaReferences);
    expect(after.connections).toBe(before.connections);
    expect(after.extensionInstallations).toBe(before.extensionInstallations);
    expect(store.getState().documentWorkspace.history.past).toHaveLength(1);
    expect(scheduler.size).toBe(1);
    expect(store.workspace.undo().ok).toBe(true);
    expect(store.getState().documentWorkspace.document).toEqual(before);
    expect(store.workspace.redo().ok).toBe(true);
    expect(store.getState().documentWorkspace.document).toEqual(after);
    await store.workspace.flushSave();
    expect(saveDocument).toHaveBeenCalledTimes(1);
    store.disposeWorkspace();
  });

  it("detaches to root and normalizes only changed source siblings", () => {
    const { store } = placementSetup();
    const before = store.getState().documentWorkspace.document!;
    const command = placementCommand(before, [ids.card], null);
    command.payload.updates[0].to.x = 800;
    expect(store.workspace.dispatchCommand(command).ok).toBe(true);
    const after = store.getState().documentWorkspace.document!;
    expect(after.elements[ids.card].data.placement).toBeNull();
    expect(after.elements[ids.card].geometry.x).toBe(800);
    expect(after.elements[ids.image].data.placement).toEqual({
      containerId: ids.container,
      order: 0,
    });
    expect(after.elements[ids.sibling]).toBe(before.elements[ids.sibling]);
    store.disposeWorkspace();
  });

  it("reorders within the shared image/card namespace after removing the moving IDs", () => {
    const { store } = placementSetup();
    const before = store.getState().documentWorkspace.document!;
    expect(
      store.workspace.dispatchCommand(
        placementCommand(before, [ids.card], { containerId: ids.container, index: 1 }),
      ).ok,
    ).toBe(true);
    const after = store.getState().documentWorkspace.document!;
    expect(after.elements[ids.image].data.placement).toEqual({
      containerId: ids.container,
      order: 0,
    });
    expect(after.elements[ids.card].data.placement).toEqual({
      containerId: ids.container,
      order: 1,
    });
    store.disposeWorkspace();
  });

  it("inserts root and multiple-source children at the full-list index", () => {
    const input = placementInput();
    input.elements[ids.image].data.placement = null;
    const { store } = placementSetup(input);
    const before = store.getState().documentWorkspace.document!;
    const command = placementCommand(before, [ids.image, ids.sibling, ids.card], {
      containerId: ids.container,
      index: 0,
    });
    expect(store.workspace.dispatchCommand(command).ok).toBe(true);
    [ids.image, ids.sibling, ids.card].forEach((id, order) => {
      expect(store.getState().documentWorkspace.document!.elements[id].data.placement).toEqual({
        containerId: ids.container,
        order,
      });
    });
    store.disposeWorkspace();
  });

  it.each([ids.container, ids.target, ids.sibling])(
    "allows a locked parent or indirectly shifted sibling (%s)",
    (id) => {
      const { store } = placementSetup(geometryLock(placementInput(), id));
      expect(
        store.workspace.dispatchCommand(
          placementCommand(store.getState().documentWorkspace.document!),
        ).ok,
      ).toBe(true);
      store.disposeWorkspace();
    },
  );

  it.each([ids.card, ids.image])(
    "rejects directly reparenting locked %s without geometry changes",
    (id) => {
      const { store, scheduler } = placementSetup(geometryLock(placementInput(), id));
      const before = store.getState().documentWorkspace;
      expect(
        store.workspace.dispatchCommand(placementCommand(before.document!, [ids.card, ids.image]))
          .ok,
      ).toBe(false);
      expect(store.getState().documentWorkspace).toBe(before);
      expect(scheduler.size).toBe(0);
      store.disposeWorkspace();
    },
  );

  it.each([
    [false, true],
    [true, false],
  ])("honors effective lock activation (%s/%s)", (active, configured) => {
    const { store } = placementSetup(geometryLock(placementInput(), ids.card, active, configured));
    expect(
      store.workspace.dispatchCommand(
        placementCommand(store.getState().documentWorkspace.document!),
      ).ok,
    ).toBe(true);
    store.disposeWorkspace();
  });

  it("keeps an unchanged locked drop a no-op, including existing numeric gaps", () => {
    const { store, scheduler } = placementSetup(geometryLock(placementInput(), ids.card));
    const before = store.getState().documentWorkspace;
    const command = placementCommand(before.document!, [ids.card], {
      containerId: ids.container,
      index: 0,
    });
    expect(store.workspace.dispatchCommand(command)).toMatchObject({ ok: true, changed: false });
    expect(store.getState().documentWorkspace).toBe(before);
    expect(scheduler.size).toBe(0);
    store.disposeWorkspace();
  });

  it.each([ids.card, ids.image])(
    "generic data replacement cannot bypass placement for %s",
    (id) => {
      const { store } = placementSetup();
      const before = store.getState().documentWorkspace;
      for (const placement of [null, { containerId: ids.target, order: 9 }]) {
        expect(
          store.workspace.dispatchCommand({
            type: "document.element.replace-data",
            payload: {
              elementId: id,
              data: { ...before.document!.elements[id].data, placement },
            },
          }).ok,
        ).toBe(false);
        expect(store.getState().documentWorkspace).toBe(before);
      }
      expect(
        store.workspace.dispatchCommand({
          type: "document.element.replace-data",
          payload: {
            elementId: id,
            data: { ...before.document!.elements[id].data, accent: "purple" },
          },
        }).ok,
      ).toBe(true);
      expect(store.getState().documentWorkspace.document!.canvases[TEST_IDS.canvasA]).toBe(
        before.document!.canvases[TEST_IDS.canvasA],
      );
      store.disposeWorkspace();
    },
  );
});
