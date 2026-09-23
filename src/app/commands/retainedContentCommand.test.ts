// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  geometryIds as ids,
  geometryInput,
  geometryLock,
  geometrySetup,
} from "./retainedGeometryTestSupport";
import { TEST_IDS } from "../../elements/cardContainerTestFixtures";
import type { ElementId } from "../../domain/ids/entityIds";
import type { TaskMapDocument } from "../../domain/document/documentTypes";

function contentEdit(document: TaskMapDocument, elementId: ElementId, to: Record<string, unknown>) {
  const element = document.elements[elementId];
  return {
    type: "document.elements.edit-content",
    payload: {
      canvasId: element.canvasId,
      updates: [
        {
          elementId,
          type: element.type,
          from: Object.fromEntries(Object.keys(to).map((key) => [key, element.data[key]])),
          to,
        },
      ],
    },
  };
}

describe("retained committed content", () => {
  it.each([
    [ids.container, { name: "New title", accent: "#123", headerButtonsVisible: true }],
    [ids.card, { text: "**Hello**\n世界", link: "https://example.com/", accent: "purple" }],
    [
      ids.block,
      { name: "Notes", text: "## Markdown\nText", headerButtonsVisible: false, accent: "purple" },
    ],
    [ids.mindmap, { text: "Node 📌", accent: "purple" }],
    [ids.image, { accent: "purple", background: false }],
  ] as [ElementId, Record<string, unknown>][])(
    "edits fields on %s and permits retained locked content controls",
    (id, to) => {
      const { store } = geometrySetup(geometryLock(geometryInput(), id));
      const before = store.getState().documentWorkspace.document!;
      expect(store.workspace.dispatchCommand(contentEdit(before, id, to))).toMatchObject({
        ok: true,
        changed: true,
      });
      const after = store.getState().documentWorkspace.document!;
      expect(after.elements[id].data).toEqual({ ...before.elements[id].data, ...to });
      expect(after.elements[id].geometry).toBe(before.elements[id].geometry);
      expect(after.canvases).toBe(before.canvases);
      expect(after.extensionInstallations).toBe(before.extensionInstallations);
      expect(after.mediaReferences).toBe(before.mediaReferences);
      expect(after.connections).toBe(before.connections);
      expect(store.workspace.undo().ok).toBe(true);
      expect(store.getState().documentWorkspace.document).toEqual(before);
      expect(store.workspace.redo().ok).toBe(true);
      expect(store.getState().documentWorkspace.document).toEqual(after);
      store.disposeWorkspace();
    },
  );

  it("commits a multi-type color action in one history/save transaction", async () => {
    const { store, scheduler, saveDocument } = geometrySetup();
    const before = store.getState().documentWorkspace.document!;
    const updates = Object.values(ids).flatMap(
      (id) => contentEdit(before, id, { accent: "purple" }).payload.updates,
    );
    expect(
      store.workspace.dispatchCommand({
        type: "document.elements.edit-content",
        payload: { canvasId: TEST_IDS.canvasA, updates },
      }).ok,
    ).toBe(true);
    expect(store.getState().documentWorkspace.history.past).toHaveLength(1);
    expect(scheduler.size).toBe(1);
    expect(store.workspace.undo().ok).toBe(true);
    expect(store.getState().documentWorkspace.document).toEqual(before);
    expect(store.workspace.redo().ok).toBe(true);
    await store.workspace.flushSave();
    expect(saveDocument).toHaveBeenCalledTimes(1);
    store.disposeWorkspace();
  });

  it("compares only captured fields, preserves unrelated edits, and rejects stale content", () => {
    const { store, scheduler } = geometrySetup();
    const before = store.getState().documentWorkspace.document!;
    const text = contentEdit(before, ids.card, { text: "Changed text" });
    expect(
      store.workspace.dispatchCommand(contentEdit(before, ids.card, { accent: "blue" })).ok,
    ).toBe(true);
    expect(store.workspace.dispatchCommand(text).ok).toBe(true);
    expect(store.getState().documentWorkspace.document!.elements[ids.card].data.accent).toBe(
      "blue",
    );
    const current = store.getState().documentWorkspace;
    expect(store.workspace.dispatchCommand(text).ok).toBe(false);
    expect(store.getState().documentWorkspace).toBe(current);
    expect(scheduler.size).toBe(1);
    store.disposeWorkspace();
  });

  it.each(Object.values(ids))(
    "suppresses equal-value and empty edits, including full replacement on %s",
    (id) => {
      const { store, scheduler } = geometrySetup();
      const before = store.getState().documentWorkspace;
      const document = before.document!;
      for (const command of [
        contentEdit(document, id, {}),
        contentEdit(document, id, { accent: document.elements[id].data.accent }),
        {
          type: "document.element.replace-data",
          payload: { elementId: id, data: { ...document.elements[id].data } },
        },
      ]) {
        expect(store.workspace.dispatchCommand(command)).toMatchObject({
          ok: true,
          changed: false,
        });
        expect(store.getState().documentWorkspace).toBe(before);
      }
      expect(scheduler.size).toBe(0);
      store.disposeWorkspace();
    },
  );

  it("keeps canonical empty content/link removal valid without editor draft normalization", () => {
    const { store } = geometrySetup();
    const before = store.getState().documentWorkspace.document!;
    expect(
      store.workspace.dispatchCommand(contentEdit(before, ids.card, { text: "", link: null })).ok,
    ).toBe(true);
    expect(store.getState().documentWorkspace.document!.elements[ids.card].data.text).toBe("");
    store.disposeWorkspace();
  });
});
