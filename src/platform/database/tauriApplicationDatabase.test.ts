// @vitest-environment node
import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTauriApplicationDatabase } from "./tauriApplicationDatabase";
import { createValidatedDatabaseClient } from "./createValidatedDatabaseClient";
import { databaseTransportFixture } from "./applicationDatabaseTestSupport";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
const ipc = vi.mocked(invoke);
const payload = (index: number) =>
  JSON.parse(new TextDecoder().decode(ipc.mock.calls[index][1] as Uint8Array));
beforeEach(() => ipc.mockReset());

describe("scoped application database client", () => {
  it.each(["stable", "development"] as const)(
    "resolves %s from native authority without opening a file",
    async (edition) => {
      ipc.mockResolvedValue(edition);
      const result = await createTauriApplicationDatabase(() => true);
      expect(result).toMatchObject({
        ok: true,
        value: { edition, expectedPurpose: edition === "stable" ? "production" : "development" },
      });
      expect(ipc.mock.calls.map(([command]) => command)).toEqual(["app_database_edition"]);
    },
  );
  it("rejects an unknown native edition", async () => {
    ipc.mockResolvedValue("unknown");
    expect(await createTauriApplicationDatabase(() => true)).toMatchObject({
      ok: false,
      error: { code: "permission_denied" },
    });
  });
  it.each(["production", "development"] as const)(
    "confirms only matching %s documents, then binds saves to that session",
    async (purpose) => {
      const fixture = databaseTransportFixture(purpose);
      const client = createValidatedDatabaseClient("app", purpose);
      ipc
        .mockResolvedValueOnce(fixture.pending)
        .mockResolvedValueOnce(fixture.session)
        .mockResolvedValueOnce({ session: { ...fixture.session, revision: 5 }, revision: 5 });
      expect((await client.unlockDatabase({ password: "test-password" })).ok).toBe(true);
      expect(
        (
          await client.saveDocument({
            serializedDocument: fixture.loaded.serializedDocument,
            expectedRevision: 4,
          })
        ).ok,
      ).toBe(true);
      expect(ipc.mock.calls.map(([command]) => command)).toEqual([
        "app_unlock_database",
        "app_confirm_unlock",
        "app_save_document",
      ]);
      expect(payload(1).databasePurpose).toBe(purpose);
      expect(payload(2)).toMatchObject({
        sessionId: fixture.session.sessionId,
        databaseId: fixture.document.databaseId,
        expectedRevision: 4,
      });
    },
  );
  it.each(["production", "development"] as const)(
    "cancels a pending wrong-purpose document in the %s client",
    async (purpose) => {
      const fixture = databaseTransportFixture(
        purpose === "production" ? "development" : "production",
      );
      ipc.mockResolvedValueOnce(fixture.pending).mockResolvedValueOnce({ phase: "closed" });
      const client = createValidatedDatabaseClient("app", purpose);
      expect(await client.unlockDatabase({ password: "test" })).toMatchObject({
        ok: false,
        error: { code: "database_purpose_mismatch" },
      });
      expect(ipc.mock.calls.map(([command]) => command)).toEqual([
        "app_unlock_database",
        "app_cancel_pending_unlock",
      ]);
    },
  );
  it("requires a validated load even when status reports an unlocked session", async () => {
    const fixture = databaseTransportFixture();
    const client = createValidatedDatabaseClient("app", "production");
    ipc.mockResolvedValue(fixture.session);
    await client.getSessionStatus();
    expect(
      (
        await client.saveDocument({
          serializedDocument: fixture.loaded.serializedDocument,
          expectedRevision: 4,
        })
      ).ok,
    ).toBe(false);
    expect(ipc).toHaveBeenCalledTimes(1);
  });
  it.each(["phase", "sessionId", "databaseId", "revision"] as const)(
    "rejects changed confirmation %s and closes the candidate",
    async (field) => {
      const fixture = databaseTransportFixture();
      const replacement = field === "revision" ? 99 : field === "phase" ? "locked" : "different";
      ipc
        .mockResolvedValueOnce(fixture.pending)
        .mockResolvedValueOnce({ ...fixture.session, [field]: replacement })
        .mockResolvedValueOnce({ phase: "closed" });
      const client = createValidatedDatabaseClient("app", "production");
      expect((await client.unlockDatabase({ password: "test" })).ok).toBe(false);
      expect(ipc.mock.calls.slice(-1)[0]?.[0]).toBe("app_close_database");
    },
  );
  it("rejects invalid pending recovery metadata before confirmation", async () => {
    const fixture = databaseTransportFixture();
    ipc
      .mockResolvedValueOnce({ ...fixture.pending, recoveredFromRevision: 4 })
      .mockResolvedValueOnce({ phase: "closed" });
    expect(
      (
        await createValidatedDatabaseClient("app", "production").unlockDatabase({
          password: "test",
        })
      ).ok,
    ).toBe(false);
    expect(ipc.mock.calls.map(([command]) => command)).toEqual([
      "app_unlock_database",
      "app_cancel_pending_unlock",
    ]);
  });
  it("invalidates the captured save identity on lock", async () => {
    const fixture = databaseTransportFixture();
    const client = createValidatedDatabaseClient("app", "production");
    ipc
      .mockResolvedValueOnce(fixture.loaded)
      .mockResolvedValueOnce({ ...fixture.session, phase: "locked" });
    await client.readDocument();
    await client.lockDatabase();
    expect(
      (
        await client.saveDocument({
          serializedDocument: fixture.loaded.serializedDocument,
          expectedRevision: 4,
        })
      ).ok,
    ).toBe(false);
    expect(ipc).toHaveBeenCalledTimes(2);
  });
  it("uses scoped picker/recent commands and passes only the picked token to open", async () => {
    ipc
      .mockResolvedValueOnce("stable")
      .mockResolvedValueOnce({ authorizationToken: "one-use", displayPath: "test.tmapdb" })
      .mockResolvedValueOnce({ edition: "stable", version: 1, recentDatabases: [] })
      .mockResolvedValueOnce({ session: { phase: "locked" }, warnings: [] });
    const platform = await createTauriApplicationDatabase(() => true);
    if (!platform.ok) throw new Error("expected test platform");
    const picked = await platform.value.settingsClient.chooseDatabasePath("open");
    await platform.value.settingsClient.listRecentDatabases();
    if (!picked.ok || !picked.value) throw new Error("expected test picker result");
    await platform.value.databaseClient.openDatabase({
      authorizationToken: picked.value.authorizationToken,
    });
    expect(payload(3)).toEqual({ authorizationToken: "one-use" });
    expect(ipc.mock.calls.map(([command]) => command)).toEqual([
      "app_database_edition",
      "app_choose_database_path",
      "app_list_recent_databases",
      "app_open_database",
    ]);
  });
});
