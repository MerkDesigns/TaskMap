// @vitest-environment node
import { invoke } from "@tauri-apps/api/core";
import { expect, it, vi } from "vitest";
import { databaseTransportFixture } from "./applicationDatabaseTestSupport";
import { FakePersistenceScheduler, renameCommand } from "../../app/workspace/workspaceTestSupport";
import { createTauriDatabaseSessionController } from "../../app/database/createTauriDatabaseSessionController";
import { createCardContainerInput, TEST_IDS } from "../../elements/cardContainerTestFixtures";
import { placementCommand } from "../../app/commands/retainedPlacementTestSupport";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("./nativeSessionEvents", () => ({ subscribeNativeRevocation: vi.fn(async () => vi.fn()) }));
vi.mock("../window/windowPrivacyClient", () => ({
  tauriWindowPrivacyClient: { setProtected: vi.fn(async () => ({ ok: true, value: undefined })) },
}));
it("connects native edition and scoped transport to the guarded existing workspace/save loop", async () => {
  const fixture = databaseTransportFixture();
  // The product composition now requires retained payloads, not generic test-card JSON.
  const serializedDocument = JSON.stringify({
    ...createCardContainerInput(),
    databasePurpose: "production",
  });
  const pending = { ...fixture.pending, serializedDocument };
  const ipc = vi.mocked(invoke);
  ipc.mockReset();
  ipc.mockImplementation(async (command) => {
    switch (command) {
      case "app_database_edition":
        return "stable";
      case "app_get_session_status":
        return { phase: "closed" };
      case "app_open_database":
        return { session: { ...fixture.session, phase: "locked" }, warnings: [] };
      case "app_unlock_database":
        return pending;
      case "app_confirm_unlock":
        return fixture.session;
      case "app_save_document":
        return { session: { ...fixture.session, revision: 5 }, revision: 5 };
      case "app_lock_database":
        return { ...fixture.session, phase: "locked" };
      default:
        throw new Error("unexpected test command");
    }
  });
  const purge = vi.fn();
  const platform = await createTauriDatabaseSessionController({
    purgeDocumentResources: purge,
    scheduler: new FakePersistenceScheduler(),
  });
  if (!platform.ok) throw new Error("expected test platform");
  const { controller } = platform.value;
  expect(ipc).toHaveBeenCalledTimes(1);
  await controller.resume();
  await controller.open("authorized-token");
  expect((await controller.unlock("test-password")).ok).toBe(true);
  expect(controller.store.workspace.dispatchCommand(renameCommand("Test edit")).ok).toBe(true);
  const loaded = controller.store.getState().documentWorkspace.document!;
  expect(
    controller.store.workspace.dispatchCommand({
      type: "document.elements.edit-content",
      payload: {
        canvasId: TEST_IDS.canvasA,
        updates: [
          {
            elementId: TEST_IDS.elementB,
            type: "text-card",
            from: { text: loaded.elements[TEST_IDS.elementB].data.text },
            to: { text: "Completed edit" },
          },
        ],
      },
    }).ok,
  ).toBe(true);
  expect(
    controller.store.workspace.dispatchCommand(placementCommand(loaded, [TEST_IDS.elementB], null)),
  ).toMatchObject({ ok: true, changed: true });
  expect(
    controller.store.getState().documentWorkspace.document!.elements[TEST_IDS.elementB].data
      .placement,
  ).toBeNull();
  expect(
    controller.store.workspace.dispatchCommand({
      type: "document.elements.reorder-layers",
      payload: {
        canvasId: TEST_IDS.canvasA,
        elementIds: [TEST_IDS.elementB],
        direction: "back",
        expectedRootOrder: [TEST_IDS.elementA, TEST_IDS.elementB],
      },
    }),
  ).toMatchObject({ ok: true, changed: true });
  expect(controller.store.workspace.undo().ok).toBe(true);
  expect(controller.store.workspace.undo().ok).toBe(true);
  const staleCallback = platform.value.callbacks.captureContent([
    { elementId: TEST_IDS.elementB, fields: ["text"] },
  ])!;
  const elementId = fixture.document.canvases[fixture.document.canvasOrder[0]].elementOrder[0];
  expect(
    controller.store.workspace.dispatchCommand({
      type: "document.extension.install",
      payload: {
        installation: {
          id: "extension-instance-00000000-0000-4000-8000-000000000090",
          extensionId: "lock",
          enabled: true,
          configuration: { enabled: true },
          target: { kind: "element", elementId },
        },
      },
    }).ok,
  ).toBe(true);
  const geometry =
    controller.store.getState().documentWorkspace.document!.elements[elementId].geometry;
  expect(
    controller.store.workspace.dispatchCommand({
      type: "document.element.update-geometry",
      payload: {
        elementId,
        geometry: { ...geometry, x: geometry.x + 1 },
      },
    }).ok,
  ).toBe(false);
  expect(
    controller.store.workspace.dispatchCommand({
      type: "document.element.remove",
      payload: {
        elementId: fixture.document.canvases[fixture.document.canvasOrder[0]].elementOrder[0],
      },
    }),
  ).toMatchObject({ ok: true, changed: true });
  expect(controller.store.getState().documentWorkspace.document?.elements).toEqual({});
  expect((await controller.lock()).ok).toBe(true);
  expect(
    staleCallback.complete([{ elementId: TEST_IDS.elementB, to: { text: "Late edit" } }]),
  ).toEqual({ ok: false, code: "expired-action" });
  expect(controller.store.getState().documentWorkspace.document).toBeNull();
  expect(purge).toHaveBeenCalled();
  expect(ipc.mock.calls.map(([command]) => command)).toEqual([
    "app_database_edition",
    "app_get_session_status",
    "app_open_database",
    "app_unlock_database",
    "app_confirm_unlock",
    "app_save_document",
    "app_lock_database",
  ]);
});
