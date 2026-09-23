// @vitest-environment node
import { expect, it } from "vitest";
import { callbackSetup } from "./retainedCallbackTestSupport";
import { geometryIds as ids } from "./retainedGeometryTestSupport";
import { extensionTestCommand, extensionTestId, installIds } from "./retainedExtensionTestSupport";
import { TEST_IDS } from "../../elements/cardContainerTestFixtures";
import { asEntityId } from "../../domain/ids/entityIds";

it.each([
  "wrong-canvas",
  "duplicate-target",
  "duplicate-id",
  "retarget",
  "unknown",
  "incompatible",
  "bad-config",
  "wrong-type",
])("atomically rejects a group with %s", async (reason) => {
  const setup = await callbackSetup();
  const before = setup.store.getState().documentWorkspace;
  const command = extensionTestCommand(before.document!, [ids.card, ids.image]);
  const updates = command.payload.updates.map((update) => ({ ...update, to: { ...update.to! } }));
  if (reason === "wrong-canvas") command.payload.canvasId = TEST_IDS.canvasB;
  if (reason === "duplicate-target") updates[1] = updates[0];
  if (reason === "duplicate-id") updates[1].to.id = updates[0].to.id;
  if (reason === "retarget") updates[1].to.target = { kind: "element", elementId: ids.block };
  if (reason === "wrong-type") updates[1].elementType = "text-block";
  if (reason === "bad-config") updates[1].to.configuration = { checked: true };
  if (reason === "unknown" || reason === "incompatible") {
    updates[1].extensionId = reason === "unknown" ? "sorting" : "checkbox";
    updates[1].to.extensionId = asEntityId("extension", updates[1].extensionId);
    updates[1].to.configuration = { checked: true };
  }
  command.payload.updates = updates;
  expect(setup.store.workspace.dispatchCommand(command).ok).toBe(false);
  expect(setup.store.getState().documentWorkspace).toBe(before);
  expect(setup.scheduler.size).toBe(0);
  expect(setup.client.saveDocument).not.toHaveBeenCalled();
  await setup.dispose();
});

it.each(["missing-id", "extra-id", "duplicate-target", "duplicate-id", "bad-id"])(
  "rejects %s install completion",
  async (reason) => {
    const setup = await callbackSetup();
    const group = [ids.card, ids.image];
    const completion = installIds(group);
    if (reason === "missing-id") completion.pop();
    if (reason === "extra-id") completion.push(...installIds([ids.block]));
    if (reason === "duplicate-target") completion[1] = completion[0];
    if (reason === "duplicate-id") completion[1].installationId = completion[0].installationId;
    if (reason === "bad-id")
      completion[1].installationId = "invalid" as (typeof completion)[1]["installationId"];
    const before = setup.store.getState().documentWorkspace;
    expect(setup.actions.captureExtensionInstall("lock", group)!.complete(completion).ok).toBe(
      false,
    );
    expect(setup.store.getState().documentWorkspace).toBe(before);
    expect(setup.scheduler.size).toBe(0);
    await setup.dispose();
  },
);

it.each(["install-race", "removed", "configured", "activated", "deleted-target"])(
  "rejects a stale %s capture",
  async (reason) => {
    const setup = await callbackSetup();
    if (reason !== "install-race")
      setup.actions.captureExtensionInstall("lock", [ids.card])!.complete(installIds([ids.card]));
    const captured = setup.actions.captureExtensionRemove("lock", [ids.card])!;
    if (reason === "install-race")
      setup.store.workspace.dispatchCommand(
        extensionTestCommand(setup.store.getState().documentWorkspace.document!, [ids.card]),
      );
    if (reason === "removed")
      setup.store.workspace.dispatchCommand({
        type: "document.extension.remove",
        payload: { installationId: extensionTestId(0) },
      });
    if (reason === "configured")
      setup.store.workspace.dispatchCommand({
        type: "document.extension.replace-configuration",
        payload: { installationId: extensionTestId(0), configuration: { enabled: false } },
      });
    if (reason === "activated")
      setup.store.workspace.dispatchCommand({
        type: "document.extension.set-enabled",
        payload: { installationId: extensionTestId(0), enabled: false },
      });
    if (reason === "deleted-target")
      setup.store.workspace.dispatchCommand({
        type: "document.extension.remove",
        payload: { installationId: extensionTestId(0) },
      });
    if (reason === "deleted-target") setup.actions.captureDelete([ids.card])!.complete();
    const before = setup.store.getState().documentWorkspace;
    expect(captured.complete()).toEqual({ ok: false, code: "command-failed" });
    expect(setup.store.getState().documentWorkspace).toBe(before);
    await setup.dispose();
  },
);

it.each([{}, { enabled: "yes" }, { enabled: false, extra: true }, { query: "" }])(
  "rejects malformed lock configuration %j",
  async (configuration) => {
    const setup = await callbackSetup();
    setup.actions.captureExtensionInstall("lock", [ids.card])!.complete(installIds([ids.card]));
    const before = setup.store.getState().documentWorkspace;
    expect(
      setup.actions.captureExtensionConfiguration("lock", ids.card)!.complete(configuration),
    ).toEqual({ ok: false, code: "invalid-action" });
    expect(setup.store.getState().documentWorkspace).toBe(before);
    await setup.dispose();
  },
);

it("does not capture removed, incompatible, missing or inactive-canvas feature targets", async () => {
  const setup = await callbackSetup();
  expect(setup.actions.captureExtensionInstall("sorting", [ids.container])).toBeNull();
  expect(setup.actions.captureExtensionInstall("color-picker", [ids.image])).toBeNull();
  expect(setup.actions.captureExtensionInstall("lock", [])).toBeNull();
  expect(setup.actions.captureExtensionConfiguration("lock", ids.card)).toBeNull();
  expect(setup.actions.captureExtensionActivation("lock", ids.card)).toBeNull();
  expect(setup.actions.captureExtensionToggle("lock", ids.card)).toBeNull();
  setup.store.workspace.dispatchCommand({
    type: "document.canvas.set-active",
    payload: { canvasId: TEST_IDS.canvasB },
  });
  expect(setup.actions.captureExtensionInstall("lock", [ids.card])).toBeNull();
  await setup.dispose();
});
