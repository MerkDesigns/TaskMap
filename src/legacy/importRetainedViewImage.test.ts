import { expect, it, vi } from "vitest";
import { createDatabaseEntryPreview } from "../features/database-entry/preview/createDatabaseEntryPreview";
import { importRetainedViewImage } from "./importRetainedViewImage";
import { asEntityId } from "../domain/ids/entityIds";
import { createDeferred } from "../app/workspace/workspaceTestSupport";
import type { ImageMediaMetadata } from "../elements/image/imageModel";
import type { PlatformResult } from "../platform/platformErrors";

it("sizes a placeholder once, preserves the replacement box, and creates one transaction per import", async () => {
  const runtime = createDatabaseEntryPreview();
  await runtime.controller.resume();
  await runtime.controller.create("fixture", "fixture");
  try {
    const store = runtime.controller.store;
    const canvasId = store.getState().documentWorkspace.document!.activeCanvasId!;
    const id = asEntityId("element", `element-${crypto.randomUUID()}`);
    runtime.callbacks.captureCreateElement()!.complete({
      id,
      canvasId,
      type: "image",
      geometry: { x: 20, y: 30, width: 280, height: 200 },
      data: { mediaId: null, placement: null, accent: "blue", background: true },
    });
    expect((await importRetainedViewImage(runtime, null, { elementId: id })).ok).toBe(true);
    expect(store.getState().documentWorkspace.document!.elements[id].geometry).toEqual({
      x: 20,
      y: 30,
      width: 320,
      height: 200,
    });
    const geometry = { x: 50, y: 60, width: 160, height: 100 };
    store.workspace.dispatchCommand({
      type: "document.element.update-geometry",
      payload: { elementId: id, geometry },
    });
    const before = store.getState().documentWorkspace;
    expect((await importRetainedViewImage(runtime, null, { elementId: id })).ok).toBe(true);
    expect(store.getState().documentWorkspace.document!.elements[id].geometry).toEqual(geometry);
    expect(store.getState().documentWorkspace.history.past.length).toBe(
      before.history.past.length + 1,
    );
    expect(runtime.callbacks.undo().ok).toBe(true);
    expect(store.getState().documentWorkspace.document).toEqual(before.document);
  } finally {
    await runtime.controller.dispose();
  }
});

it("discards a completed clipboard read after navigation without retaining a new image", async () => {
  const runtime = createDatabaseEntryPreview();
  await runtime.controller.resume();
  await runtime.controller.create("fixture", "fixture");
  try {
    const pending = createDeferred<PlatformResult<ImageMediaMetadata>>();
    vi.spyOn(runtime.media, "import").mockReturnValue(pending.promise);
    const work = importRetainedViewImage(runtime, new Blob(["fixture"]), {
      x: 100,
      y: 100,
      accent: "blue",
    });
    runtime.callbacks.captureCreateCanvas()!.complete({
      id: asEntityId("canvas", `canvas-${crypto.randomUUID()}`),
      name: "Second",
      settings: { width: 1000, height: 800 },
      elementOrder: [],
    });
    const before = runtime.controller.store.getState().documentWorkspace;
    pending.resolve({
      ok: true,
      value: {
        id: asEntityId("media", "BBBBBBBBBBBBBBBBBBBBBBBB"),
        mimeType: "image/gif",
        byteLength: 20,
        pixelWidth: 80,
        pixelHeight: 80,
        altText: null,
      },
    });
    expect(await work).toEqual({ ok: false, code: "expired-action" });
    expect(runtime.controller.store.getState().documentWorkspace).toBe(before);
  } finally {
    await runtime.controller.dispose();
  }
});
