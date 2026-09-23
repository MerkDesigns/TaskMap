// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  geometryIds as ids,
  geometryInput,
  geometryLock,
  geometrySetup,
} from "./retainedGeometryTestSupport";
import { TEST_IDS } from "../../elements/cardContainerTestFixtures";
import type { ElementGeometry } from "../../domain/document/documentTypes";

const group = (elementId: string, from: ElementGeometry, to: ElementGeometry) => ({
  type: "document.elements.update-geometry",
  payload: { canvasId: TEST_IDS.canvasA, updates: [{ elementId, from, to }] },
});

describe("retained geometry action policy", () => {
  it.each(Object.entries(ids))(
    "translates %s without changing canonical extents or content",
    (_kind, id) => {
      const { store } = geometrySetup();
      const before = store.getState().documentWorkspace.document!;
      const from = before.elements[id].geometry;
      expect(
        store.workspace.dispatchCommand(
          group(id, from, { ...from, x: from.x + 10, y: from.y + 20 }),
        ).ok,
      ).toBe(true);
      const after = store.getState().documentWorkspace.document!;
      expect(after.elements[id].geometry).toEqual({ ...from, x: from.x + 10, y: from.y + 20 });
      expect(after.elements[id].data).toBe(before.elements[id].data);
      expect(after.canvases).toBe(before.canvases);
      expect(after.mediaReferences).toBe(before.mediaReferences);
      expect(store.getState().documentWorkspace.history.past).toHaveLength(1);
      store.disposeWorkspace();
    },
  );

  it.each(Object.entries(ids))("both geometry entry points protect locked %s", (_kind, id) => {
    const { store, scheduler } = geometrySetup(geometryLock(geometryInput(), id));
    const before = store.getState().documentWorkspace;
    const from = before.document!.elements[id].geometry;
    const geometry = { ...from, x: from.x + 1, width: from.width + 1 };
    for (const command of [
      group(id, from, geometry),
      { type: "document.element.update-geometry", payload: { elementId: id, geometry } },
    ]) {
      expect(store.workspace.dispatchCommand(command).ok).toBe(false);
      expect(store.getState().documentWorkspace).toBe(before);
    }
    expect(scheduler.size).toBe(0);
    store.disposeWorkspace();
  });

  it.each([ids.container, ids.block, ids.image])(
    "supports explicit size changes for resizable %s",
    (id) => {
      const { store } = geometrySetup();
      const from = store.getState().documentWorkspace.document!.elements[id].geometry;
      const to = { ...from, width: from.width + 15, height: from.height + 10 };
      expect(store.workspace.dispatchCommand(group(id, from, to)).ok).toBe(true);
      expect(store.getState().documentWorkspace.document!.elements[id].geometry).toEqual(to);
      expect(store.workspace.undo().ok).toBe(true);
      expect(store.getState().documentWorkspace.document!.elements[id].geometry).toEqual(from);
      expect(store.workspace.redo().ok).toBe(true);
      store.disposeWorkspace();
    },
  );

  it.each([ids.card, ids.mindmap])(
    "rejects persisted measured dimensions for content-sized %s",
    (id) => {
      const { store } = geometrySetup();
      const before = store.getState().documentWorkspace;
      const from = before.document!.elements[id].geometry;
      const to = { ...from, width: 77, height: 33 };
      for (const command of [
        group(id, from, to),
        { type: "document.element.update-geometry", payload: { elementId: id, geometry: to } },
      ]) {
        expect(store.workspace.dispatchCommand(command).ok).toBe(false);
        expect(store.getState().documentWorkspace).toBe(before);
      }
      store.disposeWorkspace();
    },
  );

  it.each([
    [false, true],
    [true, false],
    [false, false],
  ])("uses effective lock activation (%s / %s)", (active, configured) => {
    const { store } = geometrySetup(geometryLock(geometryInput(), ids.card, active, configured));
    const from = store.getState().documentWorkspace.document!.elements[ids.card].geometry;
    expect(
      store.workspace.dispatchCommand(group(ids.card, from, { ...from, x: from.x + 1 })).ok,
    ).toBe(true);
    store.disposeWorkspace();
  });

  it.each([false, true])(
    "deletion permission %s does not authorize moving locked elements",
    (allow) => {
      const input = geometryLock(geometryInput(), ids.container);
      input.documentSettings.allowLockedElementDeletion = allow;
      const { store } = geometrySetup(input);
      const from = store.getState().documentWorkspace.document!.elements[ids.container].geometry;
      expect(
        store.workspace.dispatchCommand(group(ids.container, from, { ...from, y: from.y + 1 })).ok,
      ).toBe(false);
      store.disposeWorkspace();
    },
  );

  it("a child's lock does not lock its container, and parent movement leaves child canonical data alone", () => {
    const { store } = geometrySetup(geometryLock(geometryInput(), ids.card));
    const before = store.getState().documentWorkspace.document!;
    const from = before.elements[ids.container].geometry;
    expect(
      store.workspace.dispatchCommand(group(ids.container, from, { ...from, x: from.x + 1 })).ok,
    ).toBe(true);
    expect(store.getState().documentWorkspace.document!.elements[ids.card]).toBe(
      before.elements[ids.card],
    );
    store.disposeWorkspace();
  });

  it("keeps unchanged locked geometry a no-op", () => {
    const { store, scheduler } = geometrySetup(geometryLock(geometryInput(), ids.card));
    const before = store.getState().documentWorkspace;
    const from = before.document!.elements[ids.card].geometry;
    expect(store.workspace.dispatchCommand(group(ids.card, from, from))).toMatchObject({
      ok: true,
      changed: false,
    });
    expect(store.getState().documentWorkspace).toBe(before);
    expect(scheduler.size).toBe(0);
    store.disposeWorkspace();
  });

  it.each(["stale", "duplicate", "missing", "wrong-canvas", "invalid-size"])(
    "rejects an entire completed group with %s input",
    (kind) => {
      const { store, scheduler } = geometrySetup();
      const before = store.getState().documentWorkspace;
      const updates = [ids.container, ids.image].map((elementId) => {
        const from = before.document!.elements[elementId].geometry;
        return { elementId: String(elementId), from: { ...from }, to: { ...from, x: from.x + 10 } };
      });
      if (kind === "stale") updates[1].from.x++;
      if (kind === "duplicate") updates[1] = updates[0];
      if (kind === "missing") updates[1].elementId = "element-00000000-0000-4000-8000-000000000099";
      if (kind === "invalid-size") updates[1].to.width = -1;
      expect(
        store.workspace.dispatchCommand({
          type: "document.elements.update-geometry",
          payload: {
            canvasId: kind === "wrong-canvas" ? TEST_IDS.canvasB : TEST_IDS.canvasA,
            updates,
          },
        }).ok,
      ).toBe(false);
      expect(store.getState().documentWorkspace).toBe(before);
      expect(scheduler.size).toBe(0);
      store.disposeWorkspace();
    },
  );
});
