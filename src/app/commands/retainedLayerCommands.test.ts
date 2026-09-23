// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  placementIds as ids,
  placementInput,
  placementSetup,
} from "./retainedPlacementTestSupport";
import { geometryLock } from "./retainedGeometryTestSupport";
import { TEST_IDS } from "../../elements/cardContainerTestFixtures";

const roots = [ids.container, ids.image, ids.block, ids.mindmap, ids.target];
const command = (
  elementIds: string[],
  direction = "front",
  expectedRootOrder: string[] = roots,
) => ({
  type: "document.elements.reorder-layers",
  payload: { canvasId: TEST_IDS.canvasA, elementIds, direction, expectedRootOrder },
});
function setup() {
  const input = geometryLock(placementInput(), ids.image);
  input.elements[ids.image].data.placement = null;
  return placementSetup(input);
}

describe("retained root layer operations", () => {
  it.each([
    ["back", [ids.image, ids.block, ids.container, ids.mindmap, ids.target]],
    ["backward", [ids.image, ids.block, ids.container, ids.mindmap, ids.target]],
    ["forward", [ids.container, ids.mindmap, ids.image, ids.block, ids.target]],
    ["front", [ids.container, ids.mindmap, ids.target, ids.image, ids.block]],
  ] as const)(
    "moves an ordered locked/unlocked group %s without changing child slots",
    async (direction, expected) => {
      const { store, scheduler, saveDocument } = setup();
      const before = store.getState().documentWorkspace.document!;
      expect(
        store.workspace.dispatchCommand(command([ids.block, ids.image], direction)),
      ).toMatchObject({ ok: true, changed: true });
      const after = store.getState().documentWorkspace.document!;
      const order = after.canvases[TEST_IDS.canvasA].elementOrder;
      expect(order.filter((id) => roots.includes(id))).toEqual(expected);
      before.canvases[TEST_IDS.canvasA].elementOrder.forEach((id, slot) => {
        if (!roots.includes(id)) expect(order[slot]).toBe(id);
      });
      expect(after.elements).toBe(before.elements);
      expect(after.connections).toBe(before.connections);
      expect(after.mediaReferences).toBe(before.mediaReferences);
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
    },
  );

  it.each(["back", "backward", "forward", "front"])(
    "keeps a noncontiguous selection in original relative order (%s)",
    (direction) => {
      const { store } = setup();
      expect(store.workspace.dispatchCommand(command([ids.mindmap, ids.image], direction)).ok).toBe(
        true,
      );
      const actual = store
        .getState()
        .documentWorkspace.document!.canvases[TEST_IDS.canvasA].elementOrder.filter((id) =>
          roots.includes(id),
        );
      expect(actual).toEqual(
        direction === "back" || direction === "backward"
          ? [ids.image, ids.mindmap, ids.container, ids.block, ids.target]
          : [ids.container, ids.block, ids.target, ids.image, ids.mindmap],
      );
      store.disposeWorkspace();
    },
  );

  it.each([
    [[], "front"],
    [roots, "front"],
    [roots, "back"],
    [[ids.target], "front"],
    [[ids.target], "forward"],
    [[ids.container], "backward"],
    [[ids.container], "back"],
  ] as [string[], string][])(
    "suppresses unchanged layer actions (%s / %s)",
    (selected, direction) => {
      const { store, scheduler } = setup();
      const before = store.getState().documentWorkspace;
      expect(store.workspace.dispatchCommand(command(selected, direction))).toMatchObject({
        ok: true,
        changed: false,
      });
      expect(store.getState().documentWorkspace).toBe(before);
      expect(scheduler.size).toBe(0);
      store.disposeWorkspace();
    },
  );

  it.each(["duplicate", "child", "missing", "stale", "direction", "canvas", "extra"])(
    "rejects %s group input atomically",
    (kind) => {
      const { store, scheduler } = setup();
      const before = store.getState().documentWorkspace;
      const request = command([ids.image]);
      if (kind === "duplicate") request.payload.elementIds.push(ids.image);
      if (kind === "child") request.payload.elementIds.push(ids.card);
      if (kind === "missing")
        request.payload.elementIds.push("element-00000000-0000-4000-8000-000000000099");
      if (kind === "stale") request.payload.expectedRootOrder = [...roots].reverse();
      if (kind === "direction") request.payload.direction = "sideways";
      if (kind === "canvas") request.payload.canvasId = TEST_IDS.canvasB;
      if (kind === "extra") Object.assign(request.payload, { force: true });
      expect(store.workspace.dispatchCommand(request).ok).toBe(false);
      expect(store.getState().documentWorkspace).toBe(before);
      expect(scheduler.size).toBe(0);
      store.disposeWorkspace();
    },
  );

  it("rejects a captured order after a previous reorder while retaining its valid pending save", () => {
    const { store, scheduler } = setup();
    const captured = command([ids.image], "front");
    expect(store.workspace.dispatchCommand(command([ids.block], "back")).ok).toBe(true);
    const before = store.getState().documentWorkspace;
    expect(store.workspace.dispatchCommand(captured).ok).toBe(false);
    expect(store.getState().documentWorkspace).toBe(before);
    expect(scheduler.size).toBe(1);
    store.disposeWorkspace();
  });

  it("guards the single API against child targets/slots and permits root-to-root absolute indices", () => {
    const { store } = setup();
    const before = store.getState().documentWorkspace;
    const order = before.document!.canvases[TEST_IDS.canvasA].elementOrder;
    for (const [elementId, toIndex] of [
      [ids.card, 0],
      [ids.image, order.indexOf(ids.card)],
      [ids.image, order.length],
    ] as const) {
      expect(
        store.workspace.dispatchCommand({
          type: "document.element.reorder",
          payload: { elementId, toIndex },
        }).ok,
      ).toBe(false);
      expect(store.getState().documentWorkspace).toBe(before);
    }
    expect(
      store.workspace.dispatchCommand({
        type: "document.element.reorder",
        payload: { elementId: ids.image, toIndex: order.indexOf(ids.image) },
      }),
    ).toMatchObject({ ok: true, changed: false });
    expect(store.getState().documentWorkspace).toBe(before);
    expect(
      store.workspace.dispatchCommand({
        type: "document.element.reorder",
        payload: { elementId: ids.image, toIndex: 0 },
      }).ok,
    ).toBe(true);
    const after = store.getState().documentWorkspace.document!;
    expect(
      after.canvases[TEST_IDS.canvasA].elementOrder.filter((id) => roots.includes(id)),
    ).toEqual([ids.image, ids.container, ids.block, ids.mindmap, ids.target]);
    expect(after.elements).toBe(before.document!.elements);
    store.disposeWorkspace();
  });
});
