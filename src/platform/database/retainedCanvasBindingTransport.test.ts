// @vitest-environment node
import { invoke } from "@tauri-apps/api/core";
import { expect, it, vi } from "vitest";
import { databaseTransportFixture } from "./applicationDatabaseTestSupport";
import { createCardContainerInput } from "../../elements/cardContainerTestFixtures";
import { createTauriDatabaseSessionController } from "../../app/database/createTauriDatabaseSessionController";
import { preferencesFixture } from "../../app/preferences/preferencesTestSupport";
import { FakePersistenceScheduler } from "../../app/workspace/workspaceTestSupport";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("./nativeSessionEvents", () => ({ subscribeNativeRevocation: vi.fn(async () => vi.fn()) }));
vi.mock("../window/windowPrivacyClient", () => ({
  tauriWindowPrivacyClient: { setProtected: vi.fn(async () => ({ ok: true, value: undefined })) },
}));

it("owns one binding after resource initialization, revokes it on lock and permits a fresh unlock binding", async () => {
  const fixture = databaseTransportFixture("development");
  const serializedDocument = JSON.stringify({
    ...createCardContainerInput(),
    databasePurpose: "development",
  });
  const ipc = vi.mocked(invoke);
  ipc.mockImplementation(async (command) => {
    switch (command) {
      case "app_database_edition":
        return "development";
      case "app_get_session_status":
      case "app_close_database":
        return { phase: "closed" };
      case "app_open_database":
        return { session: { ...fixture.session, phase: "locked" }, warnings: [] };
      case "app_unlock_database":
        return { ...fixture.pending, serializedDocument };
      case "app_confirm_unlock":
        return fixture.session;
      case "app_load_preferences":
        return preferencesFixture();
      case "app_view_state":
        return null;
      case "app_lock_database":
        return { ...fixture.session, phase: "locked" };
      default:
        throw new Error("Unexpected fixture command");
    }
  });
  const purge = vi.fn();
  const platform = await createTauriDatabaseSessionController({
    purgeDocumentResources: purge,
    scheduler: new FakePersistenceScheduler(),
  });
  if (!platform.ok) throw new Error("Expected platform");
  const runtime = platform.value;
  const onRevoke = vi.fn();
  const input = {
    viewport: { pan: { x: 0, y: 0 }, zoom: 1, screen: { width: 800, height: 600 } },
    onRevoke,
  };
  try {
    await runtime.controller.resume();
    await runtime.controller.open("fixture-token");
    expect((await runtime.controller.unlock("fixture-password")).ok).toBe(true);
    expect(() => runtime.bindCanvas(input)).toThrow("initialized resources");
    expect((await runtime.initializeResources()).ok).toBe(true);
    const first = runtime.bindCanvas(input);
    expect(first.getSnapshot()).toMatchObject({ phase: "ready" });
    expect(() => runtime.bindCanvas(input)).toThrow("already has a mounted canvas");
    expect((await runtime.controller.lock()).ok).toBe(true);
    expect(first.getSnapshot()).toEqual({ phase: "revoked" });
    expect(onRevoke).toHaveBeenCalledOnce();
    expect(purge).toHaveBeenCalledOnce();
    expect((await runtime.controller.unlock("fixture-password")).ok).toBe(true);
    expect((await runtime.initializeResources()).ok).toBe(true);
    const second = runtime.bindCanvas(input);
    expect(second).not.toBe(first);
    expect(first.getSnapshot()).toEqual({ phase: "revoked" });
    expect(second.getSnapshot()).toMatchObject({ phase: "ready" });
    expect((await runtime.controller.dispose()).ok).toBe(true);
    expect(second.getSnapshot()).toEqual({ phase: "revoked" });
    expect(onRevoke).toHaveBeenCalledTimes(2);
  } finally {
    await runtime.controller.dispose();
  }
});
