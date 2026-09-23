// @vitest-environment node
import { expect, it, vi } from "vitest";
import { callbackSetup } from "./retainedCallbackTestSupport";
import { retainedSettingFields, type RetainedSettingField } from "./retainedSettingsCallbacks";
import { settingsEntries, type RetainedSettingsUpdate } from "./retainedSettingsCommand";

const changes: Record<RetainedSettingField, RetainedSettingsUpdate> = {
  "grid.style": { grid: { style: "lines" } },
  "grid.opacityPercent.dots": { grid: { opacityPercent: { dots: 23 } } },
  "grid.opacityPercent.lines": { grid: { opacityPercent: { lines: 37 } } },
  showElementShadows: { showElementShadows: true },
  allowLockedElementDeletion: { allowLockedElementDeletion: false },
  minimapEnabled: { minimapEnabled: false },
};

it.each(retainedSettingFields)(
  "routes %s through one reversible document transaction",
  async (field) => {
    const setup = await callbackSetup();
    const before = setup.store.getState().documentWorkspace.document!;
    const edit = setup.actions.captureDocumentSettings([field])!;
    expect(edit.complete(changes[field])).toEqual({ ok: true, changed: true });
    const after = setup.store.getState().documentWorkspace;
    const values = new Map(settingsEntries(after.document!.documentSettings));
    for (const [key, value] of settingsEntries(changes[field])) expect(values.get(key)).toBe(value);
    expect(after.history.past).toHaveLength(1);
    expect(after.document!.elements).toBe(before.elements);
    expect(after.document!.mediaReferences).toBe(before.mediaReferences);
    expect(after.document!.canvases).toBe(before.canvases);
    expect(setup.actions.undo()).toEqual({ ok: true, changed: true });
    expect(setup.store.getState().documentWorkspace.document).toEqual(before);
    expect(setup.actions.redo()).toEqual({ ok: true, changed: true });
    expect(setup.store.getState().documentWorkspace.document).toEqual(after.document);
    expect(edit.complete(changes[field])).toEqual({ ok: false, code: "expired-action" });
    await setup.dispose();
  },
);

it("groups selected leaves without overwriting a concurrent unrelated setting", async () => {
  const setup = await callbackSetup();
  const edit = setup.actions.captureDocumentSettings(["grid.style", "grid.opacityPercent.dots"])!;
  expect(
    setup.store.workspace.dispatchCommand({
      type: "document.settings.update",
      payload: { settings: { minimapEnabled: false } },
    }).ok,
  ).toBe(true);
  expect(edit.complete({ grid: { style: "lines", opacityPercent: { dots: 0 } } })).toEqual({
    ok: true,
    changed: true,
  });
  const state = setup.store.getState().documentWorkspace;
  expect(state.document!.documentSettings).toMatchObject({
    grid: { style: "lines", opacityPercent: { dots: 0 } },
    minimapEnabled: false,
  });
  expect(state.history.past).toHaveLength(2);
  expect(setup.actions.undo().ok).toBe(true);
  expect(setup.store.getState().documentWorkspace.document!.documentSettings.minimapEnabled).toBe(
    false,
  );
  await setup.dispose();
});

it.each([null, { grid: { style: "dots" as const } }])(
  "treats cancelled/equal completion as a true no-op: %j",
  async (value) => {
    const setup = await callbackSetup();
    const before = setup.store.getState().documentWorkspace;
    expect(setup.actions.captureDocumentSettings(["grid.style"])!.complete(value)).toEqual({
      ok: true,
      changed: false,
    });
    expect(setup.store.getState().documentWorkspace).toBe(before);
    expect(setup.scheduler.size).toBe(0);
    await setup.dispose();
  },
);

it("keeps 1,000 settings preview samples local, then commits and saves once", async () => {
  const setup = await callbackSetup();
  const before = setup.store.getState().documentWorkspace;
  const edit = setup.actions.captureDocumentSettings(["grid.opacityPercent.dots"])!;
  const dispatch = vi.spyOn(setup.store.workspace, "dispatchCommand");
  const serialize = vi.spyOn(JSON, "stringify");
  try {
    let preview = 0;
    for (let sample = 0; sample < 1000; sample++) preview = sample % 101;
    expect(setup.store.getState().documentWorkspace).toBe(before);
    expect(dispatch).not.toHaveBeenCalled();
    expect(setup.scheduler.size).toBe(0);
    expect(edit.complete({ grid: { opacityPercent: { dots: preview } } })).toEqual({
      ok: true,
      changed: true,
    });
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(serialize).not.toHaveBeenCalled();
    expect(setup.client.saveDocument).not.toHaveBeenCalled();
    expect(setup.scheduler.size).toBe(1);
    expect(setup.store.getState().documentWorkspace.history.past).toHaveLength(1);
  } finally {
    serialize.mockRestore();
    dispatch.mockRestore();
  }
  await setup.store.workspace.flushSave();
  expect(setup.client.saveDocument).toHaveBeenCalledTimes(1);
  await setup.dispose();
});
