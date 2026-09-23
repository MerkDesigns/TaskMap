// @vitest-environment node
import { expect, it } from "vitest";
import { getArchitectureExtensionDefinitions } from "../../extensions/architectureRegistry";
import { createRetainedExtensionsProjection } from "../view-projection/createRetainedExtensionsProjection";
import { callbackSetup } from "./retainedCallbackTestSupport";
import { geometryIds as ids } from "./retainedGeometryTestSupport";
import { extensionInstallation, extensionTestId, installIds } from "./retainedExtensionTestSupport";

it.each(getArchitectureExtensionDefinitions())(
  "installs, configures, preserves and removes $id with shared compatibility/defaults",
  async (definition) => {
    const setup = await callbackSetup();
    const read = () => setup.store.getState().documentWorkspace.document!;
    const before = read();
    const targets = Object.values(ids).filter((id) =>
      definition.compatibleElementTypes.includes(before.elements[id].type),
    );
    expect(
      setup.actions
        .captureExtensionInstall(definition.id, [...Object.values(ids), ids.container])!
        .complete(installIds(targets)),
    ).toEqual({ ok: true, changed: true });
    const installed = read();
    expect(Object.values(installed.extensionInstallations)).toHaveLength(targets.length);
    expect(installed.elements).toBe(before.elements);
    expect(installed.mediaReferences).toBe(before.mediaReferences);
    for (const id of targets)
      expect(extensionInstallation(installed, definition.id, id).configuration).toEqual(
        definition.createDefaultState(),
      );
    expect(setup.store.getState().documentWorkspace.history.past).toHaveLength(1);
    expect(setup.store.workspace.undo().ok).toBe(true);
    expect(read()).toEqual(before);
    expect(setup.store.workspace.redo().ok).toBe(true);
    const elementId = targets[0];
    const configuration =
      definition.id === "checkbox"
        ? { checked: true }
        : definition.id === "search"
          ? { query: "  exact Query\n " }
          : { enabled: false };
    expect(
      setup.actions
        .captureExtensionConfiguration(definition.id, elementId)!
        .complete(configuration),
    ).toEqual({ ok: true, changed: true });
    expect(createRetainedExtensionsProjection().project(read()).byElement.get(elementId)).toEqual({
      [definition.viewKey]: configuration,
    });
    const edited = read();
    expect(setup.actions.captureExtensionInstall(definition.id, targets)!.complete([])).toEqual({
      ok: true,
      changed: false,
    });
    expect(
      setup.actions
        .captureExtensionConfiguration(definition.id, elementId)!
        .complete(configuration),
    ).toEqual({ ok: true, changed: false });
    expect(read()).toBe(edited);
    expect(
      setup.actions.captureExtensionActivation(definition.id, elementId)!.complete(false),
    ).toEqual({ ok: true, changed: true });
    expect(
      createRetainedExtensionsProjection().project(read()).byElement.get(elementId)?.[
        definition.viewKey
      ],
    ).toBeUndefined();
    const inactive = read();
    expect(setup.actions.captureExtensionInstall(definition.id, targets)!.complete([])).toEqual({
      ok: true,
      changed: false,
    });
    expect(read()).toBe(inactive);
    expect(extensionInstallation(read(), definition.id, elementId)).toMatchObject({
      enabled: false,
      configuration,
    });
    expect(
      setup.actions.captureExtensionActivation(definition.id, elementId)!.complete(true).ok,
    ).toBe(true);
    expect(
      setup.actions.captureExtensionRemove(definition.id, Object.values(ids))!.complete(),
    ).toEqual({ ok: true, changed: true });
    expect(Object.values(read().extensionInstallations)).toHaveLength(0);
    expect(setup.store.workspace.undo().ok).toBe(true);
    expect(extensionInstallation(read(), definition.id, elementId).configuration).toEqual(
      configuration,
    );
    expect(setup.store.workspace.redo().ok).toBe(true);
    const removed = setup.store.getState().documentWorkspace;
    expect(
      setup.actions.captureExtensionRemove(definition.id, Object.values(ids))!.complete(),
    ).toEqual({ ok: true, changed: false });
    expect(setup.store.getState().documentWorkspace).toBe(removed);
    await setup.store.workspace.flushSave();
    expect(setup.client.saveDocument).toHaveBeenCalledTimes(1);
    await setup.dispose();
  },
);

it("applies the primary lock value uniformly, skipping uninstalled members without changing activation", async () => {
  const setup = await callbackSetup();
  const group = [ids.card, ids.block, ids.image];
  setup.actions.captureExtensionInstall("lock", group)!.complete(installIds(group));
  setup.actions.captureExtensionConfiguration("lock", ids.block)!.complete({ enabled: false });
  setup.actions.captureExtensionActivation("lock", ids.image)!.complete(false);
  const before = setup.store.getState().documentWorkspace;
  expect(
    setup.actions.captureExtensionToggle("lock", ids.card, [...group, ids.container])!.complete(),
  ).toEqual({ ok: true, changed: true });
  const after = setup.store.getState().documentWorkspace;
  expect(after.history.past).toHaveLength(before.history.past.length + 1);
  for (const id of group)
    expect(extensionInstallation(after.document!, "lock", id).configuration).toEqual({
      enabled: false,
    });
  expect(extensionInstallation(after.document!, "lock", ids.image).enabled).toBe(false);
  expect(extensionInstallation(after.document!, "lock", ids.container)).toBeUndefined();
  expect(setup.store.workspace.undo().ok).toBe(true);
  expect(setup.store.getState().documentWorkspace.document).toEqual(before.document);
  await setup.dispose();
});

it("adds only missing group installations while preserving unrelated edits and configured members", async () => {
  const setup = await callbackSetup();
  setup.actions.captureExtensionInstall("lock", [ids.card])!.complete(installIds([ids.card]));
  setup.actions.captureExtensionConfiguration("lock", ids.card)!.complete({ enabled: false });
  const captured = setup.actions.captureExtensionInstall("lock", [ids.card, ids.image])!;
  setup.actions
    .captureMove(ids.block, [ids.block])!
    .complete({ operation: setup.move([ids.block]) });
  const before = setup.store.getState().documentWorkspace.document!;
  expect(captured.complete([{ elementId: ids.image, installationId: extensionTestId(1) }])).toEqual(
    { ok: true, changed: true },
  );
  const after = setup.store.getState().documentWorkspace.document!;
  expect(after.elements).toBe(before.elements);
  expect(after.extensionInstallations[extensionTestId(0)]).toBe(
    before.extensionInstallations[extensionTestId(0)],
  );
  expect(extensionInstallation(after, "lock", ids.image).configuration).toEqual({ enabled: true });
  await setup.dispose();
});

it.each(["lock", "privacy", "checkbox"] as const)(
  "toggles %s on the primary alone outside a lock group",
  async (extensionId) => {
    const setup = await callbackSetup();
    const primary = extensionId === "checkbox" ? ids.card : ids.container;
    setup.actions.captureExtensionInstall(extensionId, [primary])!.complete(installIds([primary]));
    expect(
      setup.actions.captureExtensionToggle(extensionId, primary, [ids.image])!.complete().ok,
    ).toBe(true);
    expect(
      extensionInstallation(
        setup.store.getState().documentWorkspace.document!,
        extensionId,
        primary,
      ),
    ).toMatchObject({
      enabled: true,
      configuration: extensionId === "checkbox" ? { checked: true } : { enabled: false },
    });
    await setup.dispose();
  },
);
