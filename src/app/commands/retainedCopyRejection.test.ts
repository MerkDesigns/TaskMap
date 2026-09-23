// @vitest-environment node
import { expect, it } from "vitest";
import { callbackSetup } from "./retainedCallbackTestSupport";
import { geometryIds as ids } from "./retainedGeometryTestSupport";
import { copyInput, prepareCopy, copiedElementId } from "./retainedCopyTestSupport";
import { buildRetainedPaste } from "./retainedPasteCompletion";
import { TEST_IDS } from "../../elements/cardContainerTestFixtures";

it.each([
  "missing-element",
  "duplicate-source",
  "duplicate-id",
  "source-id-reuse",
  "missing-edge",
  "missing-extension",
  "invalid-position",
  "extra-field",
])("rejects a malformed %s completion without a write", async (reason) => {
  const setup = await callbackSetup(copyInput());
  const before = setup.store.getState().documentWorkspace;
  const { completion } = prepareCopy(before.document!);
  if (reason === "missing-element") completion.elements.pop();
  if (reason === "duplicate-source") completion.elements[1] = completion.elements[0];
  if (reason === "duplicate-id") completion.elements[1].id = completion.elements[0].id;
  if (reason === "source-id-reuse") completion.elements[0].id = completion.elements[0].sourceId;
  if (reason === "missing-edge") completion.connections = [];
  if (reason === "missing-extension") completion.installations = [];
  if (reason === "invalid-position") completion.elements[0].position.x = Infinity;
  if (reason === "extra-field") Object.assign(completion, { arbitrary: true });
  const captured = setup.actions.captureCopy(Object.values(ids))!;
  expect(captured.complete(completion)).toEqual({ ok: false, code: "invalid-action" });
  expect(captured.complete(null)).toEqual({ ok: false, code: "expired-action" });
  expect(setup.store.getState().documentWorkspace).toBe(before);
  expect(setup.scheduler.size).toBe(0);
  await setup.dispose();
});

it.each([
  "wrong-canvas",
  "existing-element",
  "existing-edge",
  "existing-extension",
  "external-parent",
  "external-edge",
  "external-extension",
  "unknown-type",
  "bad-config",
  "missing-media",
  "extra-media",
  "duplicate-media",
])("atomically rejects %s in the named paste command", async (reason) => {
  const setup = await callbackSetup(copyInput());
  const before = setup.store.getState().documentWorkspace;
  const { snapshot, completion } = prepareCopy(before.document!);
  const command = buildRetainedPaste(snapshot, completion);
  const payload = command.payload;
  if (reason === "wrong-canvas") payload.canvasId = TEST_IDS.canvasB;
  if (reason === "existing-element") payload.elements[0].id = ids.container;
  if (reason === "existing-edge") payload.connections[0].id = TEST_IDS.connection;
  if (reason === "existing-extension") payload.installations[0].id = TEST_IDS.extensionA;
  if (reason === "external-parent")
    Object.assign(payload.elements[1].data, {
      placement: { containerId: ids.container, order: 8 },
    });
  if (reason === "external-edge") payload.connections[0].target.elementId = ids.image;
  if (reason === "external-extension") payload.installations[0].target.elementId = ids.image;
  if (reason === "unknown-type") Object.assign(payload.elements[0], { type: "unsupported" });
  if (reason === "bad-config") payload.installations[0].configuration = { checked: true };
  if (reason === "missing-media") payload.media = [];
  if (reason === "extra-media")
    payload.elements = payload.elements.filter((element) => element.type !== "image");
  if (reason === "duplicate-media") payload.media.push(payload.media[0]);
  expect(setup.store.workspace.dispatchCommand(command).ok).toBe(false);
  expect(setup.store.getState().documentWorkspace).toBe(before);
  expect(setup.scheduler.size).toBe(0);
  expect(setup.client.saveDocument).not.toHaveBeenCalled();
  await setup.dispose();
});

it("rejects changed media metadata rather than importing or overwriting it", async () => {
  const setup = await callbackSetup(copyInput());
  const { completion } = prepareCopy(setup.store.getState().documentWorkspace.document!, [
    ids.image,
  ]);
  const captured = setup.actions.captureCopy([ids.image])!;
  expect(
    setup.store.workspace.dispatchCommand({
      type: "document.media.update-metadata",
      payload: {
        mediaId: TEST_IDS.media,
        metadata: { altText: "Changed" },
      },
    }).ok,
  ).toBe(true);
  const before = setup.store.getState().documentWorkspace;
  expect(captured.complete(completion)).toEqual({ ok: false, code: "command-failed" });
  expect(setup.store.getState().documentWorkspace).toBe(before);
  await setup.dispose();
});

it("does not capture missing/wrong-canvas targets", async () => {
  const setup = await callbackSetup();
  expect(setup.actions.captureCopy([copiedElementId(0)])).toBeNull();
  setup.store.workspace.dispatchCommand({
    type: "document.canvas.set-active",
    payload: { canvasId: TEST_IDS.canvasB },
  });
  expect(setup.actions.captureCopy([ids.card])).toBeNull();
  await setup.dispose();
});
