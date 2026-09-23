// @vitest-environment node
import { expect, it, vi } from "vitest";
import { callbackSetup } from "./retainedCallbackTestSupport";
import { geometryIds as ids } from "./retainedGeometryTestSupport";
import { extensionTestId, extensionInstallation } from "./retainedExtensionTestSupport";
import { prepareCopy } from "./retainedCopyTestSupport";
import {
  containerCardInput,
  newContainerCard,
  aiPayload,
  aiIdentities,
} from "./retainedContainerCardTestSupport";
import { parseCopyPasteJson } from "../../extensions/copyPasteJson";

it.each([0, 1, 2])(
  "inserts a fresh card at shared slot %s with companion defaults and one history entry",
  async (index) => {
    const setup = await callbackSetup(containerCardInput());
    const before = setup.store.getState().documentWorkspace.document!;
    const card = newContainerCard();
    expect(setup.actions.captureNewContainerCard(ids.container, index)!.complete(card)).toEqual({
      ok: true,
      changed: true,
    });
    const after = setup.store.getState().documentWorkspace.document!;
    expect(after.elements[card.id].data).toMatchObject({
      accent: before.elements[ids.container].data.accent,
      text: card.data.text,
      placement: { containerId: ids.container, order: index },
    });
    expect(extensionInstallation(after, "checkbox", card.id)).toMatchObject({
      enabled: true,
      configuration: { checked: false },
    });
    const expectedIds = [ids.card, ids.image];
    expectedIds.splice(index, 0, card.id);
    expectedIds.forEach((id, order) =>
      expect(after.elements[id].data.placement).toEqual({ containerId: ids.container, order }),
    );
    expect(after.elements[ids.image].geometry).toBe(before.elements[ids.image].geometry);
    expect(after.elements[ids.container]).toBe(before.elements[ids.container]);
    expect(after.mediaReferences).toBe(before.mediaReferences);
    expect(setup.store.getState().documentWorkspace.history.past).toHaveLength(1);
    expect(setup.store.workspace.undo().ok).toBe(true);
    expect(setup.store.getState().documentWorkspace.document).toEqual(before);
    expect(setup.store.workspace.redo().ok).toBe(true);
    await setup.store.workspace.flushSave();
    expect(setup.client.saveDocument).toHaveBeenCalledTimes(1);
    await setup.dispose();
  },
);

it.each(["active-configured-off", "inactive", "absent"])(
  "preserves %s companion presence semantics",
  async (mode) => {
    const input = containerCardInput();
    for (const index of [1, 2]) {
      if (mode === "absent") delete input.extensionInstallations[extensionTestId(index)];
      else if (mode === "inactive")
        input.extensionInstallations[extensionTestId(index)].enabled = false;
      else input.extensionInstallations[extensionTestId(index)].configuration = { enabled: false };
    }
    const setup = await callbackSetup(input);
    const card = newContainerCard();
    if (mode !== "active-configured-off") card.checkboxInstallationId = null;
    expect(setup.actions.captureNewContainerCard(ids.container, 0)!.complete(card).ok).toBe(true);
    const after = setup.store.getState().documentWorkspace.document!;
    expect(after.elements[card.id].data.accent).toBe(
      mode === "active-configured-off" ? "#123456" : card.data.accent,
    );
    expect(!!extensionInstallation(after, "checkbox", card.id)).toBe(
      mode === "active-configured-off",
    );
    await setup.dispose();
  },
);

it.each(["checked", "inactive", "missing"])(
  "pastes a card preserving supplied color and %s checkbox state",
  async (mode) => {
    const input = containerCardInput();
    if (mode === "missing") delete input.extensionInstallations[extensionTestId(5)];
    if (mode === "inactive") input.extensionInstallations[extensionTestId(5)].enabled = false;
    const setup = await callbackSetup(input);
    const before = setup.store.getState().documentWorkspace.document!;
    const { completion } = prepareCopy(before, [ids.card]);
    expect(
      setup.actions.captureCopy([ids.card])!.complete({
        ...completion,
        target: {
          containerId: ids.container,
          index: 1,
          checkboxInstallationId: mode === "missing" ? extensionTestId(22) : null,
        },
      }),
    ).toEqual({ ok: true, changed: true });
    const after = setup.store.getState().documentWorkspace.document!;
    const copiedId = completion.elements[0].id;
    expect(after.elements[copiedId].data.accent).toBe(before.elements[ids.card].data.accent);
    expect(extensionInstallation(after, "checkbox", copiedId)).toMatchObject({
      enabled: mode !== "inactive",
      configuration: { checked: mode !== "missing" },
    });
    expect(setup.store.getState().documentWorkspace.history.past).toHaveLength(1);
    await setup.dispose();
  },
);

it.each([0, 1, 3])(
  "replaces cards from AI JSON (%s cards), retaining images and removing old card extensions",
  async (count) => {
    const setup = await callbackSetup(containerCardInput());
    const before = setup.store.getState().documentWorkspace.document!;
    const payload = aiPayload(count);
    const cards = aiIdentities(count);
    expect(
      setup.actions
        .captureContainerJsonReplace(ids.container)!
        .complete({ json: JSON.stringify(payload), cards }),
    ).toEqual({ ok: true, changed: true });
    const after = setup.store.getState().documentWorkspace.document!;
    expect(after.elements[ids.container].data).toEqual({
      ...before.elements[ids.container].data,
      name: payload.name,
      accent: payload.color,
    });
    expect(after.elements[ids.card]).toBeUndefined();
    expect(after.extensionInstallations[extensionTestId(5)]).toBeUndefined();
    expect(after.elements[ids.image].geometry).toBe(before.elements[ids.image].geometry);
    expect(after.mediaReferences).toBe(before.mediaReferences);
    const order = count
      ? [cards[0].id, ids.image, ...cards.slice(1).map(({ id }) => id)]
      : [ids.image];
    order.forEach((id, index) =>
      expect(after.elements[id].data.placement).toEqual({
        containerId: ids.container,
        order: index,
      }),
    );
    cards.forEach((card, index) => {
      expect(after.elements[card.id].data).toMatchObject({
        text: payload.cards[index].text,
        accent: payload.cards[index].color,
        link: payload.cards[index].hyperlink,
      });
      expect(extensionInstallation(after, "checkbox", card.id).configuration).toEqual({
        checked: false,
      });
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

it("exports the retained AI JSON shape only on explicit request without touching history or clipboard", async () => {
  const setup = await callbackSetup(containerCardInput());
  const before = setup.store.getState().documentWorkspace;
  const dispatch = vi.spyOn(setup.store.workspace, "dispatchCommand");
  const json = setup.actions.getContainerJsonForAi(ids.container)!;
  expect(parseCopyPasteJson(json).success).toBe(true);
  expect(JSON.parse(json)).toMatchObject({
    name: "Ideas 🗂️",
    color: "#123456",
    cards: [{ text: "First line\n第二行", color: "#fedcba", hyperlink: null }],
  });
  expect(dispatch).not.toHaveBeenCalled();
  expect(setup.store.getState().documentWorkspace).toBe(before);
  expect(setup.scheduler.size).toBe(0);
  dispatch.mockRestore();
  await setup.controller.lock();
  expect(setup.actions.getContainerJsonForAi(ids.container)).toBeNull();
  await setup.dispose();
});
