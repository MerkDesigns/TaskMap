// @vitest-environment node
import { expect, it } from "vitest";
import { callbackSetup } from "./retainedCallbackTestSupport";
import { geometryIds, geometryInput, geometryLock } from "./retainedGeometryTestSupport";
import { asEntityId } from "../../domain/ids/entityIds";
import { imageElementSchema } from "../../elements/image/imageModel";

const media = {
  id: asEntityId("media", "BBBBBBBBBBBBBBBBBBBBBBBB"),
  mimeType: "image/gif" as const,
  byteLength: 20,
  pixelWidth: 320,
  pixelHeight: 200,
  altText: null,
};

it.each([true, false])("replaces media atomically and reversibly; empty=%s", async (empty) => {
  const input = geometryInput();
  if (empty) input.elements[geometryIds.image].data.mediaId = null;
  const setup = await callbackSetup(input);
  try {
    const before = setup.store.getState().documentWorkspace.document!;
    const image = imageElementSchema.parse(before.elements[geometryIds.image]);
    const capture = setup.actions.captureImageReplacement(image.id)!;
    const geometry = empty ? { ...image.geometry, width: 320, height: 200 } : image.geometry;
    expect(capture.complete({ media, geometry })).toEqual({ ok: true, changed: true });
    const after = setup.store.getState().documentWorkspace;
    expect(after.history.past).toHaveLength(1);
    expect(after.document!.elements[image.id]).toEqual({
      ...image,
      geometry,
      data: { ...image.data, mediaId: media.id },
    });
    expect(after.document!.connections).toEqual(before.connections);
    expect(after.document!.mediaReferences[media.id]).toEqual(media);
    expect(setup.actions.undo().ok).toBe(true);
    expect(setup.store.getState().documentWorkspace.document).toEqual(before);
    expect(setup.actions.redo().ok).toBe(true);
  } finally {
    await setup.dispose();
  }
});

it.each(["move", "delete", "navigate", "lock", "undo"])(
  "rejects replacement after %s without registering metadata",
  async (change) => {
    const setup = await callbackSetup();
    try {
      const document = setup.store.getState().documentWorkspace.document!;
      const image = imageElementSchema.parse(document.elements[geometryIds.image]);
      if (change === "undo")
        setup.store.workspace.dispatchCommand({
          type: "document.element.update-geometry",
          payload: {
            elementId: image.id,
            geometry: { ...image.geometry, x: image.geometry.x + 1 },
          },
        });
      const capture = setup.actions.captureImageReplacement(image.id)!;
      if (change === "move")
        setup.store.workspace.dispatchCommand({
          type: "document.element.update-geometry",
          payload: {
            elementId: image.id,
            geometry: { ...image.geometry, x: image.geometry.x + 1 },
          },
        });
      if (change === "delete")
        setup.store.workspace.dispatchCommand({
          type: "document.element.remove",
          payload: { elementId: image.id },
        });
      if (change === "navigate") setup.actions.switchCanvas(document.canvasOrder[1]);
      if (change === "lock") await setup.controller.lock();
      if (change === "undo") setup.actions.undo();
      const before = setup.store.getState().documentWorkspace;
      expect(capture.complete({ media, geometry: image.geometry }).ok).toBe(false);
      expect(setup.store.getState().documentWorkspace).toBe(before);
    } finally {
      await setup.dispose();
    }
  },
);

it("rejects resizing a locked placeholder and preserves unrelated content during ordinary replacement", async () => {
  const input = geometryLock(geometryInput(), geometryIds.image);
  input.elements[geometryIds.image].data.mediaId = null;
  const setup = await callbackSetup(input);
  try {
    const image = imageElementSchema.parse(
      setup.store.getState().documentWorkspace.document!.elements[geometryIds.image],
    );
    const before = setup.store.getState().documentWorkspace;
    expect(
      setup.actions
        .captureImageReplacement(image.id)!
        .complete({ media, geometry: { ...image.geometry, width: image.geometry.width + 1 } }).ok,
    ).toBe(false);
    expect(setup.store.getState().documentWorkspace).toBe(before);
    const captured = setup.actions.captureImageReplacement(image.id)!;
    setup.store.workspace.dispatchCommand({
      type: "document.elements.edit-content",
      payload: {
        canvasId: image.canvasId,
        updates: [
          {
            elementId: image.id,
            type: "image",
            from: { background: image.data.background },
            to: { background: !image.data.background },
          },
        ],
      },
    });
    expect(captured.complete({ media, geometry: image.geometry }).ok).toBe(true);
    expect(
      setup.store.getState().documentWorkspace.document!.elements[image.id].data.background,
    ).toBe(!image.data.background);
  } finally {
    await setup.dispose();
  }
});
