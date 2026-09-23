// @vitest-environment node
import { expect, it } from "vitest";
import { callbackSetup } from "./retainedCallbackTestSupport";
import { geometryIds as ids } from "./retainedGeometryTestSupport";
import { extensionTestId } from "./retainedExtensionTestSupport";
import {
  containerCardInput,
  newContainerCard,
  aiPayload,
  aiIdentities,
} from "./retainedContainerCardTestSupport";
import { prepareCopy } from "./retainedCopyTestSupport";

it.each([
  "container-content",
  "child-content",
  "child-geometry",
  "extension-config",
  "extension-activation",
  "new-sibling",
])("rejects stale %s before insertion or replacement", async (reason) => {
  for (const operation of ["insert", "replace"]) {
    const setup = await callbackSetup(containerCardInput());
    const insert =
      operation === "insert" ? setup.actions.captureNewContainerCard(ids.container, 0)! : null;
    const replace =
      operation === "replace" ? setup.actions.captureContainerJsonReplace(ids.container)! : null;
    if (reason === "container-content" || reason === "child-content") {
      const elementId = reason === "container-content" ? ids.container : ids.card;
      const field = reason === "container-content" ? "name" : "text";
      const data = setup.store.getState().documentWorkspace.document!.elements[elementId].data;
      expect(
        setup.store.workspace.dispatchCommand({
          type: "document.element.replace-data",
          payload: {
            elementId,
            data: { ...data, [field]: "Changed" },
          },
        }).ok,
      ).toBe(true);
    }
    if (reason === "child-geometry")
      setup.actions
        .captureMove(ids.image, [ids.image])!
        .complete({ operation: setup.move([ids.image]) });
    if (reason === "extension-config")
      setup.store.workspace.dispatchCommand({
        type: "document.extension.replace-configuration",
        payload: { installationId: extensionTestId(1), configuration: { enabled: false } },
      });
    if (reason === "extension-activation")
      setup.store.workspace.dispatchCommand({
        type: "document.extension.set-enabled",
        payload: { installationId: extensionTestId(1), enabled: false },
      });
    if (reason === "new-sibling") {
      const { completion } = prepareCopy(setup.store.getState().documentWorkspace.document!, [
        ids.card,
      ]);
      expect(
        setup.actions.captureCopy([ids.card])!.complete({
          ...completion,
          target: { containerId: ids.container, index: 0, checkboxInstallationId: null },
        }).ok,
      ).toBe(true);
    }
    const before = setup.store.getState().documentWorkspace;
    const result = insert
      ? insert.complete(newContainerCard())
      : replace!.complete({ json: JSON.stringify(aiPayload()), cards: aiIdentities() });
    expect(result).toEqual({ ok: false, code: "command-failed" });
    expect(setup.store.getState().documentWorkspace).toBe(before);
    await setup.dispose();
  }
});

it.each([
  "bad-json",
  "extra-field",
  "bad-color",
  "unsafe-link",
  "missing-card-id",
  "duplicate-card-id",
  "old-card-id",
  "duplicate-checkbox-id",
  "missing-checkbox-id",
  "existing-checkbox-id",
  "bad-geometry",
])("rejects %s AI replacement atomically", async (reason) => {
  const setup = await callbackSetup(containerCardInput());
  const payload = aiPayload();
  const cards = aiIdentities();
  if (reason === "extra-field") Object.assign(payload, { extra: true });
  if (reason === "bad-color") payload.color = "red";
  if (reason === "unsafe-link") payload.cards[0].hyperlink = "javascript:alert(1)";
  if (reason === "missing-card-id") cards.pop();
  if (reason === "duplicate-card-id") cards[1].id = cards[0].id;
  if (reason === "old-card-id") cards[0].id = ids.card;
  if (reason === "duplicate-checkbox-id")
    cards[1].checkboxInstallationId = cards[0].checkboxInstallationId;
  if (reason === "missing-checkbox-id") cards[0].checkboxInstallationId = null;
  if (reason === "existing-checkbox-id") cards[0].checkboxInstallationId = extensionTestId(5);
  if (reason === "bad-geometry") cards[1].geometry.width = -1;
  const before = setup.store.getState().documentWorkspace;
  expect(
    setup.actions
      .captureContainerJsonReplace(ids.container)!
      .complete({ json: reason === "bad-json" ? "{" : JSON.stringify(payload), cards }).ok,
  ).toBe(false);
  expect(setup.store.getState().documentWorkspace).toBe(before);
  expect(setup.scheduler.size).toBe(0);
  expect(setup.client.saveDocument).not.toHaveBeenCalled();
  await setup.dispose();
});

it.each(["existing-id", "missing-checkbox", "invalid-geometry"])(
  "rejects %s fresh card without partial insertion",
  async (reason) => {
    const setup = await callbackSetup(containerCardInput());
    const card = newContainerCard();
    if (reason === "existing-id") card.id = ids.card;
    if (reason === "missing-checkbox") card.checkboxInstallationId = null;
    if (reason === "invalid-geometry") card.geometry.height = -1;
    const before = setup.store.getState().documentWorkspace;
    expect(setup.actions.captureNewContainerCard(ids.container, 0)!.complete(card).ok).toBe(false);
    expect(setup.store.getState().documentWorkspace).toBe(before);
    expect(setup.scheduler.size).toBe(0);
    await setup.dispose();
  },
);

it.each([ids.block, ids.image, ids.mindmap, ids.container])(
  "rejects non-single-card container paste from %s",
  async (sourceId) => {
    const setup = await callbackSetup(containerCardInput());
    const before = setup.store.getState().documentWorkspace;
    const { completion } = prepareCopy(before.document!, [sourceId]);
    expect(
      setup.actions.captureCopy([sourceId])!.complete({
        ...completion,
        target: { containerId: ids.container, index: 0, checkboxInstallationId: null },
      }).ok,
    ).toBe(false);
    expect(setup.store.getState().documentWorkspace).toBe(before);
    await setup.dispose();
  },
);
