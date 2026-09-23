// @vitest-environment node
import { expect, it, vi } from "vitest";
import { createDevicePreferences } from "./createDevicePreferences";
import { createRememberedViews } from "./createRememberedViews";
import { preferencesClientFixture } from "./preferencesTestSupport";
import { callbackSetup } from "../commands/retainedCallbackTestSupport";
import { createRetainedCanvasInteractionController } from "../interactions/createRetainedCanvasInteractionController";
import { createViewport } from "../../canvas/geometry/viewportMath";
import { TEST_IDS } from "../../elements/cardContainerTestFixtures";
import { geometryInput } from "../commands/retainedGeometryTestSupport";
import { asEntityId } from "../../domain/ids/entityIds";
import { rememberedViewsSchema } from "../../platform/settings/preferenceContracts";
import {
  createDeferred as deferred,
  FakePersistenceScheduler,
} from "../workspace/workspaceTestSupport";

it("serializes load and captured preference edits without losing concurrent fields", async () => {
  const { client } = preferencesClientFixture();
  const prefs = createDevicePreferences(client);
  const loading = prefs.load();
  const first = prefs.update({ toolbarButtonsVisible: false });
  const second = prefs.update({ privacyModeEnabled: true });
  expect((await loading).ok).toBe(true);
  expect((await first).ok).toBe(true);
  expect((await second).ok).toBe(true);
  expect(client.save.mock.calls.map(([revision]) => revision)).toEqual([0, 1]);
  expect(prefs.getSnapshot()?.preferences).toMatchObject({
    toolbarButtonsVisible: false,
    privacyModeEnabled: true,
  });
  expect(Object.isFrozen(prefs.getSnapshot()?.preferences)).toBe(true);
  prefs.dispose();
});

it("rejects foreign settings and keeps failed saves visible without overwriting state", async () => {
  const { client } = preferencesClientFixture();
  const prefs = createDevicePreferences(client);
  await prefs.load();
  expect((await prefs.update({ camera: {} } as never)).ok).toBe(false);
  client.save.mockResolvedValue({
    ok: false,
    error: { code: "revision_conflict", message: "Test", retryable: false },
  });
  expect((await prefs.update({ toolbarButtonsVisible: false })).ok).toBe(false);
  expect(prefs.getSnapshot()?.preferences.toolbarButtonsVisible).toBe(true);
  expect((await prefs.flush()).ok).toBe(false);
  prefs.dispose();
});

it("suppresses stale preference loads after disposal", async () => {
  const { client } = preferencesClientFixture();
  const pending = deferred<Awaited<ReturnType<typeof client.load>>>();
  client.load.mockReturnValue(pending.promise);
  const prefs = createDevicePreferences(client);
  const loaded = prefs.load();
  await Promise.resolve();
  prefs.dispose();
  pending.resolve({
    ok: true,
    value: { ...(await preferencesClientFixture().client.load()).value },
  });
  expect((await loaded).ok).toBe(false);
  expect(prefs.getSnapshot()).toBeNull();
});

it("persists only settled camera, with no document/history/serialization during 100 pointer samples", async () => {
  const setup = await callbackSetup();
  const { client, view } = preferencesClientFixture();
  const scheduler = new FakePersistenceScheduler();
  const views = createRememberedViews(setup.controller, client, scheduler);
  expect((await views.load()).ok).toBe(true);
  const viewport = createViewport({ x: 0, y: 0 }, 1, { width: 800, height: 600 });
  const interaction = createRetainedCanvasInteractionController({
    actions: setup.actions,
    viewport,
    canvasKey: TEST_IDS.canvasA,
    onViewportSettled: views.remember,
  });
  const before = setup.store.getState().documentWorkspace;
  const serialize = vi.spyOn(JSON, "stringify");
  try {
    interaction.beginPan(1, { x: 0, y: 0 });
    for (let x = 1; x <= 100; x++)
      interaction.updatePointer({ pointerId: 1, screen: { x, y: x }, snapping: false });
    expect(serialize).not.toHaveBeenCalled();
    expect(view.save).not.toHaveBeenCalled();
    expect(setup.store.getState().documentWorkspace).toBe(before);
    interaction.completePointer({ pointerId: 1, screen: { x: 100, y: 100 }, snapping: false });
    expect(scheduler.size).toBe(1);
    expect((await views.flush()).ok).toBe(true);
    expect(view.save).toHaveBeenCalledTimes(1);
    expect(views.get(TEST_IDS.canvasA)?.pan).toEqual({ x: 100, y: 100 });
    expect(setup.store.getState().documentWorkspace).toBe(before);
    expect(setup.client.saveDocument).not.toHaveBeenCalled();
  } finally {
    serialize.mockRestore();
  }
  interaction.dispose();
  views.dispose();
  await setup.dispose();
});

it.each(["reload", "clear"])("discards pending view-state load on %s", async (reason) => {
  const setup = await callbackSetup();
  const { client, view } = preferencesClientFixture();
  const pending = deferred<Awaited<ReturnType<typeof view.load>>>();
  view.load.mockReturnValue(pending.promise);
  const views = createRememberedViews(setup.controller, client);
  const loading = views.load();
  if (reason === "reload")
    setup.store.workspace.load(setup.store.getState().documentWorkspace.document!, 4);
  else views.clear();
  pending.resolve({ ok: true, value: { version: 1, canvases: {} } });
  expect((await loading).ok).toBe(false);
  expect(views.isReady()).toBe(false);
  views.dispose();
  await setup.dispose();
});

it("retains per-canvas views across navigation but purges them on workspace replacement", async () => {
  const setup = await callbackSetup();
  const { client, view } = preferencesClientFixture();
  const scheduler = new FakePersistenceScheduler();
  const views = createRememberedViews(setup.controller, client, scheduler);
  await views.load();
  const viewport = createViewport({ x: 10, y: 20 }, 1.5, { width: 800, height: 600 });
  expect(views.remember(viewport, TEST_IDS.canvasA)).toBe(true);
  setup.actions.switchCanvas(TEST_IDS.canvasB);
  expect(views.get(TEST_IDS.canvasA)).toEqual(viewport);
  expect(views.remember(viewport, TEST_IDS.canvasB)).toBe(true);
  await views.flush();
  expect(view.save).toHaveBeenCalledTimes(1);
  setup.store.workspace.clear();
  expect(views.get(TEST_IDS.canvasA)).toBeNull();
  expect(scheduler.size).toBe(0);
  views.dispose();
  await setup.dispose();
});

it("keeps camera writes valid at the document's 256-canvas limit", async () => {
  const input = geometryInput();
  const ids = Array.from({ length: 254 }, (_, index) =>
    asEntityId(
      "canvas",
      `canvas-00000000-0000-4000-8000-${(index + 1000).toString().padStart(12, "0")}`,
    ),
  );
  for (const id of ids) {
    input.canvases[id] = {
      id,
      name: "Test",
      settings: { width: 1000, height: 800 },
      elementOrder: [],
    };
    input.canvasOrder.push(id);
  }
  const setup = await callbackSetup(input);
  const { client, view } = preferencesClientFixture();
  const save = vi.fn(async (value?: unknown) => {
    expect(rememberedViewsSchema.safeParse(value).success).toBe(true);
    return { ok: true as const, value: undefined };
  });
  client.captureViews.mockReturnValue({ ...view, save });
  const views = createRememberedViews(setup.controller, client, new FakePersistenceScheduler());
  expect((await views.load()).ok).toBe(true);
  const viewport = createViewport({ x: 10, y: 20 }, 1, { width: 800, height: 600 });
  for (const id of [...ids, TEST_IDS.canvasA, TEST_IDS.canvasB])
    expect(views.remember(viewport, id)).toBe(true);
  expect(views.get(ids[0])).toEqual(viewport);
  expect(views.get(ids[253])).toEqual(viewport);
  expect((await views.flush()).ok).toBe(true);
  expect(save).toHaveBeenCalledTimes(1);
  views.dispose();
  await setup.dispose();
});
