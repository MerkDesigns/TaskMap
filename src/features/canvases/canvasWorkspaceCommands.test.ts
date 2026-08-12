import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAppStore } from "../../app/store";
import { createTaskMapDocument } from "../../domain/document/createDocument";
import { asEntityId } from "../../domain/ids/entityIds";
import { createCanvas, deleteCanvas, selectCanvas, updateCanvas } from "./canvasWorkspaceCommands";

function createLoadedStore() {
  let sequence = 1;
  const document = createTaskMapDocument({
    databaseId: asEntityId("database", "database-00000000-0000-4000-8000-000000000001"),
    databasePurpose: "development",
    idSource: {
      nextUuid: () => `00000000-0000-4000-8000-${String(sequence++).padStart(12, "0")}`,
    },
  });
  const store = createAppStore();
  expect(store.workspace.load(document, 0).ok).toBe(true);
  return store;
}

beforeEach(() => {
  vi.spyOn(crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000099");
});

describe("canvas workspace command wiring", () => {
  it("creates, selects, edits, and deletes through workspace commands", () => {
    const store = createLoadedStore();
    const originalId = store.getState().documentWorkspace.document!.activeCanvasId!;
    const createdId = createCanvas(store.workspace, {
      name: "  Planning  ",
      width: 4_000,
      height: 2_000,
    });
    let document = store.getState().documentWorkspace.document!;
    expect(document.activeCanvasId).toBe(createdId);
    expect(document.canvases[createdId]?.name).toBe("Planning");

    updateCanvas(store.workspace, createdId, { name: "Delivery", width: 5_000, height: 2_500 });
    selectCanvas(store.workspace, originalId);
    document = store.getState().documentWorkspace.document!;
    expect(document.activeCanvasId).toBe(originalId);
    expect(document.canvases[createdId]?.settings).toEqual({ width: 5_000, height: 2_500 });

    deleteCanvas(store.workspace, createdId);
    expect(store.getState().documentWorkspace.document!.canvases[createdId]).toBeUndefined();
  });
});
