// @vitest-environment node
import { expect, it } from "vitest";
import { callbackSetup } from "./retainedCallbackTestSupport";
import { geometryIds as ids } from "./retainedGeometryTestSupport";
import { TEST_IDS } from "../../elements/cardContainerTestFixtures";

it("commits canonical translation and resize, ignoring measured extents/resize positions", async () => {
  const setup = await callbackSetup();
  const before = setup.store.getState().documentWorkspace.document!;
  expect(
    setup.actions.captureMove(ids.card, [ids.card])!.complete({ operation: setup.move() }),
  ).toEqual({ ok: true, changed: true });
  expect(setup.store.getState().documentWorkspace.document!.elements[ids.card].geometry).toEqual({
    ...before.elements[ids.card].geometry,
    x: 310,
    y: 40,
  });
  const from = before.elements[ids.image].geometry;
  expect(
    setup.actions.captureResize(ids.image)!.complete({
      id: ids.image,
      handle: "bottom-right",
      from: { ...from, x: 999 },
      to: { ...from, x: 999, width: 400, height: 300 },
    }),
  ).toEqual({ ok: true, changed: true });
  expect(setup.store.getState().documentWorkspace.document!.elements[ids.image].geometry).toEqual({
    ...from,
    width: 400,
    height: 300,
  });
  expect(setup.store.workspace.undo().ok).toBe(true);
  expect(setup.store.workspace.undo().ok).toBe(true);
  expect(setup.store.getState().documentWorkspace.document).toEqual(before);
  await setup.dispose();
});

it.each([null, { containerId: ids.container, index: 1 }])(
  "completes explicit root/full-list placement %j atomically",
  async (target) => {
    const setup = await callbackSetup();
    const captured = setup.actions.captureMove(ids.card, [ids.card], [ids.card])!;
    const operation = { ...setup.move(), completionBehavior: "place" as const };
    expect(captured.complete({ operation, target })).toEqual({ ok: true, changed: true });
    const after = setup.store.getState().documentWorkspace;
    expect(after.document!.elements[ids.card].data.placement).toEqual(
      target ? { containerId: ids.container, order: 1 } : null,
    );
    expect(after.document!.elements[ids.card].geometry.x).toBe(310);
    expect(after.history.past).toHaveLength(1);
    expect(setup.scheduler.size).toBe(1);
    await setup.dispose();
  },
);

it.each(["missing-decision", "wrong-member", "duplicate-member", "wrong-primary"])(
  "rejects %s move completion and consumes the handle",
  async (kind) => {
    const setup = await callbackSetup();
    const captured = setup.actions.captureMove(ids.card, [ids.card], [ids.card])!;
    const operation = setup.move();
    const invalid =
      kind === "missing-decision"
        ? { ...operation, completionBehavior: "place" as const }
        : kind === "wrong-member"
          ? { ...operation, targets: [{ ...operation.targets[0], id: ids.image }] }
          : kind === "wrong-primary"
            ? { ...operation, primaryId: ids.image }
            : { ...operation, targets: [...operation.targets, operation.targets[0]] };
    const before = setup.store.getState().documentWorkspace;
    expect(captured.complete({ operation: invalid })).toEqual({
      ok: false,
      code: "invalid-action",
    });
    expect(setup.store.getState().documentWorkspace).toBe(before);
    expect(captured.complete({ operation })).toEqual({ ok: false, code: "expired-action" });
    await setup.dispose();
  },
);

it("keeps captured placement preconditions instead of refreshing them at completion", async () => {
  const setup = await callbackSetup();
  const captured = setup.actions.captureMove(ids.card, [ids.card], [ids.card])!;
  const operation = { ...setup.move(), completionBehavior: "place" as const };
  expect(setup.actions.captureDelete([ids.image])!.complete().ok).toBe(true);
  const before = setup.store.getState().documentWorkspace;
  expect(captured.complete({ operation, target: null })).toEqual({
    ok: false,
    code: "command-failed",
  });
  expect(setup.store.getState().documentWorkspace).toBe(before);
  await setup.dispose();
});

it("honors mid-gesture locking and filters contained layer selections only at capture", async () => {
  const setup = await callbackSetup();
  const captured = setup.actions.captureMove(ids.card, [ids.card])!;
  const operation = setup.move();
  setup.store.workspace.dispatchCommand({
    type: "document.extension.install",
    payload: {
      installation: {
        id: TEST_IDS.extensionA,
        extensionId: "lock",
        enabled: true,
        configuration: { enabled: true },
        target: { kind: "element", elementId: ids.card },
      },
    },
  });
  expect(captured.complete({ operation })).toEqual({ ok: false, code: "command-failed" });
  expect(setup.actions.captureLayers([ids.card, ids.container], "front")!.complete()).toEqual({
    ok: true,
    changed: true,
  });
  expect(
    setup.store.getState().documentWorkspace.document!.elements[ids.card].data.placement,
  ).toEqual({ containerId: ids.container, order: 3 });
  await setup.dispose();
});
