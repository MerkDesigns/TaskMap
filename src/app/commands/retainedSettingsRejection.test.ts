// @vitest-environment node
import { expect, it } from "vitest";
import { callbackSetup } from "./retainedCallbackTestSupport";
import type { RetainedSettingField } from "./retainedSettingsCallbacks";
import type { RetainedSettingsUpdate } from "./retainedSettingsCommand";
import { TEST_IDS } from "../../elements/cardContainerTestFixtures";

it.each(
  [[], ["grid.style", "grid.style"], ["camera"], ["defaultColor"]].map((fields) => ({ fields })),
)("rejects invalid settings capture %j", async ({ fields }) => {
  const setup = await callbackSetup();
  expect(setup.actions.captureDocumentSettings(fields as RetainedSettingField[])).toBeNull();
  expect(setup.scheduler.size).toBe(0);
  await setup.dispose();
});

it.each([
  {},
  { grid: {} },
  { grid: { style: "invalid" } },
  { grid: { opacityPercent: { dots: -1 } } },
  { grid: { opacityPercent: { dots: 101 } } },
  { grid: { style: "lines" }, minimapEnabled: false },
  { grid: { style: "lines" }, camera: { x: 50 } },
  { grid: { style: "lines" }, defaultColor: "red" },
  { grid: { style: "lines" }, showElementShadows: "false" },
])("rejects malformed or different leaf-set settings %j atomically", async (value) => {
  const setup = await callbackSetup();
  const before = setup.store.getState().documentWorkspace;
  const edit = setup.actions.captureDocumentSettings(["grid.style"])!;
  expect(edit.complete(value as RetainedSettingsUpdate)).toEqual({
    ok: false,
    code: "command-failed",
  });
  expect(setup.store.getState().documentWorkspace).toBe(before);
  expect(setup.scheduler.size).toBe(0);
  expect(edit.complete({ grid: { style: "lines" } })).toEqual({
    ok: false,
    code: "expired-action",
  });
  await setup.dispose();
});

it("rejects a targeted setting changed since capture without reverting it", async () => {
  const setup = await callbackSetup();
  const edit = setup.actions.captureDocumentSettings(["grid.opacityPercent.dots"])!;
  setup.store.workspace.dispatchCommand({
    type: "document.settings.update",
    payload: { settings: { grid: { opacityPercent: { dots: 60 } } } },
  });
  const before = setup.store.getState().documentWorkspace;
  expect(edit.complete({ grid: { opacityPercent: { dots: 70 } } })).toEqual({
    ok: false,
    code: "command-failed",
  });
  expect(setup.store.getState().documentWorkspace).toBe(before);
  await setup.dispose();
});

it.each(["cancel", "supersede", "canvas", "reload", "lock", "dispose"])(
  "expires settings captures on %s",
  async (reason) => {
    const setup = await callbackSetup();
    const edit = setup.actions.captureDocumentSettings(["grid.style"])!;
    if (reason === "cancel") edit.cancel();
    if (reason === "supersede") setup.actions.captureDocumentSettings(["minimapEnabled"]);
    if (reason === "canvas")
      setup.store.workspace.dispatchCommand({
        type: "document.canvas.set-active",
        payload: { canvasId: TEST_IDS.canvasB },
      });
    if (reason === "reload")
      setup.store.workspace.load(setup.store.getState().documentWorkspace.document!, 4);
    if (reason === "lock") await setup.controller.lock();
    if (reason === "dispose") setup.actions.dispose();
    const before = setup.store.getState().documentWorkspace;
    expect(edit.complete({ grid: { style: "lines" } })).toEqual({
      ok: false,
      code: "expired-action",
    });
    expect(setup.store.getState().documentWorkspace).toBe(before);
    await setup.dispose();
  },
);
