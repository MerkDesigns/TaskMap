import { describe, expect, it } from "vitest";
import { createDatabaseEntryPreview } from "./createDatabaseEntryPreview";

describe("in-memory entry preview", () => {
  it("can create, lock, reject a password, unlock, close, and reopen the created identity", async () => {
    const { controller, callbacks } = createDatabaseEntryPreview();
    expect((await controller.resume()).ok).toBe(true);
    expect((await controller.create("preview-token", "test-only")).ok).toBe(true);
    const id = controller.store.getState().documentWorkspace.document?.databaseId;
    const canvasId = controller.store.getState().documentWorkspace.document!.activeCanvasId!;
    expect(callbacks.captureCanvasEdit(canvasId, "name")!.complete("Saved canvas").ok).toBe(true);
    expect((await controller.lock()).ok).toBe(true);
    expect((await controller.unlock("wrong")).ok).toBe(false);
    expect((await controller.unlock("test-only")).ok).toBe(true);
    expect((await controller.close()).ok).toBe(true);
    expect((await controller.open("preview-token")).ok).toBe(true);
    expect((await controller.unlock("test-only")).ok).toBe(true);
    expect(controller.store.getState().documentWorkspace.document?.databaseId).toBe(id);
    expect(controller.store.getState().documentWorkspace.document!.canvases[canvasId].name).toBe(
      "Saved canvas",
    );
    await controller.dispose();
  });

  it("provides a valid recovered document without native storage", async () => {
    const { controller } = createDatabaseEntryPreview();
    await controller.resume();
    await controller.open("recovered-preview-token");
    expect((await controller.unlock("test-only")).ok).toBe(true);
    expect(controller.getSnapshot().recoveredFromRevision).toBe(0);
    await controller.dispose();
  });
});
