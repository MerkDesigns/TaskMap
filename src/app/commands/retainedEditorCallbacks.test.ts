// @vitest-environment node
import { expect, it } from "vitest";
import { callbackSetup } from "./retainedCallbackTestSupport";
import { captureRetainedLinkEdit, captureRetainedTextEdit } from "./retainedEditorCallbacks";
import { geometryIds as ids } from "./retainedGeometryTestSupport";
import { TEST_IDS } from "../../elements/cardContainerTestFixtures";

it.each([
  [ids.container, "name"],
  [ids.block, "name"],
  [ids.block, "text"],
  [ids.card, "text"],
  [ids.mindmap, "text"],
] as const)("finalizes %s %s once and leaves drafts transient", async (id, field) => {
  const setup = await callbackSetup();
  const before = setup.store.getState().documentWorkspace;
  const captured = captureRetainedTextEdit(setup.actions, id, field)!;
  expect(setup.store.getState().documentWorkspace).toBe(before);
  expect(captured.complete("  Final line\n第二行  ")).toEqual({ ok: true, changed: true });
  expect(setup.store.getState().documentWorkspace.document!.elements[id].data[field]).toBe(
    "Final line\n第二行",
  );
  expect(setup.store.workspace.undo().ok).toBe(true);
  expect(setup.store.getState().documentWorkspace.document).toEqual(before.document);
  await setup.dispose();
});

it.each(["", " \n\t "])("blank draft %j consumes without history/save", async (draft) => {
  const setup = await callbackSetup();
  const before = setup.store.getState().documentWorkspace;
  const captured = captureRetainedTextEdit(setup.actions, ids.card, "text")!;
  expect(captured.complete(draft)).toEqual({ ok: true, changed: false });
  expect(setup.store.getState().documentWorkspace).toBe(before);
  expect(setup.scheduler.size).toBe(0);
  expect(captured.complete("Second attempt")).toEqual({ ok: false, code: "expired-action" });
  await setup.dispose();
});

it.each([
  [" example.com/a ", "https://example.com/a"],
  ["https://example.com", "https://example.com/"],
  ["mailto:a@example.com", "mailto:a@example.com"],
  ["tel:+1234", "tel:+1234"],
  [" C:\\Docs\\a.txt ", "C:\\Docs\\a.txt"],
  ["\\\\server\\share\\a.txt", "\\\\server\\share\\a.txt"],
  ["file:///C:/Docs/a%20b.txt", "C:/Docs/a b.txt"],
  ["javascript:alert(1)", null],
  ["file:///%ZZ", null],
  ["http://", null],
  ["  ", null],
])("normalizes link entry %s without opening it", async (draft, expected) => {
  const setup = await callbackSetup();
  const captured = captureRetainedLinkEdit(setup.actions, ids.card)!;
  expect(captured.complete(draft).ok).toBe(true);
  expect(setup.store.getState().documentWorkspace.document!.elements[ids.card].data.link).toBe(
    expected,
  );
  await setup.dispose();
});

it("protects captured text but preserves an unrelated color edit", async () => {
  const setup = await callbackSetup();
  const captured = captureRetainedTextEdit(setup.actions, ids.card, "text")!;
  const document = setup.store.getState().documentWorkspace.document!;
  expect(
    setup.store.workspace.dispatchCommand({
      type: "document.elements.edit-content",
      payload: {
        canvasId: TEST_IDS.canvasA,
        updates: [
          {
            elementId: ids.card,
            type: "text-card",
            from: { accent: document.elements[ids.card].data.accent },
            to: { accent: "purple" },
          },
        ],
      },
    }).ok,
  ).toBe(true);
  expect(captured.complete("New text").ok).toBe(true);
  expect(setup.store.getState().documentWorkspace.document!.elements[ids.card].data.accent).toBe(
    "purple",
  );
  const stale = captureRetainedTextEdit(setup.actions, ids.card, "text")!;
  const current = setup.store.getState().documentWorkspace.document!;
  setup.store.workspace.dispatchCommand({
    type: "document.element.replace-data",
    payload: {
      elementId: ids.card,
      data: { ...current.elements[ids.card].data, text: "Other edit" },
    },
  });
  const before = setup.store.getState().documentWorkspace;
  expect(stale.complete("Late")).toEqual({ ok: false, code: "command-failed" });
  expect(setup.store.getState().documentWorkspace).toBe(before);
  await setup.dispose();
});

it("rejects unsupported edit fields and malformed target captures", async () => {
  const setup = await callbackSetup();
  expect(captureRetainedLinkEdit(setup.actions, ids.mindmap)).toBeNull();
  expect(captureRetainedTextEdit(setup.actions, ids.image, "text")).toBeNull();
  for (const fields of [["placement"], ["text", "text"], [], ["unknown"]])
    expect(setup.actions.captureContent([{ elementId: ids.card, fields }])).toBeNull();
  expect(setup.actions.captureContent([])).toBeNull();
  expect(setup.actions.captureMove(ids.card, [ids.card, ids.card])).toBeNull();
  expect(setup.actions.captureLayers([ids.card, ids.card], "front")).toBeNull();
  expect(setup.actions.captureDelete([ids.card, ids.card])).toBeNull();
  expect(setup.scheduler.size).toBe(0);
  await setup.dispose();
});
