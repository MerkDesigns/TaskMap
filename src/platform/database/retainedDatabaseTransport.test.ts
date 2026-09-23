// @vitest-environment node
import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createValidatedDatabaseClient } from "./createValidatedDatabaseClient";
import { databaseTransportFixture } from "./applicationDatabaseTestSupport";
import { createCardContainerInput } from "../../elements/cardContainerTestFixtures";
import { acceptRetainedDocument } from "../../app/database/acceptRetainedDocument";
import { createTauriDatabaseSessionController } from "../../app/database/createTauriDatabaseSessionController";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("./nativeSessionEvents", () => ({ subscribeNativeRevocation: vi.fn(async () => vi.fn()) }));
vi.mock("../window/windowPrivacyClient", () => ({
  tauriWindowPrivacyClient: { setProtected: vi.fn(async () => ({ ok: true, value: undefined })) },
}));
const ipc = vi.mocked(invoke);
beforeEach(() => {
  ipc.mockReset();
});

function fixture() {
  const base = databaseTransportFixture();
  const document = { ...createCardContainerInput(), databasePurpose: "production" };
  const serializedDocument = JSON.stringify(document);
  return {
    ...base,
    document,
    loaded: { ...base.loaded, serializedDocument },
    pending: { ...base.pending, serializedDocument },
  };
}
const commands = () => ipc.mock.calls.map(([command]) => command);

describe("retained feature policy at database transport boundaries", () => {
  it.each(["reject", "throw"])("cancels pending confirmation on policy %s", async (mode) => {
    const current = fixture();
    ipc.mockResolvedValueOnce(current.pending).mockResolvedValueOnce({ phase: "closed" });
    const client = createValidatedDatabaseClient("app", "production", () => {
      if (mode === "throw") throw new Error("private content");
      return false;
    });
    expect(await client.unlockDatabase({ password: "test" })).toMatchObject({
      ok: false,
      error: { code: "invalid_document_payload" },
    });
    expect(commands()).toEqual(["app_unlock_database", "app_cancel_pending_unlock"]);
    expect(
      (
        await client.saveDocument({
          serializedDocument: current.loaded.serializedDocument,
          expectedRevision: 4,
        })
      ).ok,
    ).toBe(false);
    expect(ipc).toHaveBeenCalledTimes(2);
  });

  it("falls back to close if pending cancellation fails", async () => {
    ipc
      .mockResolvedValueOnce(databaseTransportFixture().pending)
      .mockRejectedValueOnce(new Error("test failure"))
      .mockResolvedValueOnce({ phase: "closed" });
    const client = createValidatedDatabaseClient("app", "production", acceptRetainedDocument);
    expect((await client.unlockDatabase({ password: "test" })).ok).toBe(false);
    expect(commands()).toEqual([
      "app_unlock_database",
      "app_cancel_pending_unlock",
      "app_close_database",
    ]);
  });

  it("rejects an invalid create payload before consuming a path token or invoking native create", async () => {
    const current = databaseTransportFixture();
    const client = createValidatedDatabaseClient("app", "production", acceptRetainedDocument);
    expect(
      await client.createDatabase({
        authorizationToken: "unused",
        password: "test",
        databaseId: current.document.databaseId,
        documentSchemaVersion: 1,
        serializedDocument: current.loaded.serializedDocument,
      }),
    ).toMatchObject({ ok: false, error: { code: "invalid_document_payload" } });
    expect(ipc).not.toHaveBeenCalled();
  });

  it("validates native create's returned payload before confirming it", async () => {
    const current = fixture();
    ipc
      .mockResolvedValueOnce(databaseTransportFixture().pending)
      .mockResolvedValueOnce({ phase: "closed" });
    const client = createValidatedDatabaseClient("app", "production", acceptRetainedDocument);
    expect(
      (
        await client.createDatabase({
          authorizationToken: "test-token",
          password: "test",
          databaseId: current.document.databaseId,
          documentSchemaVersion: 1,
          serializedDocument: current.loaded.serializedDocument,
        })
      ).ok,
    ).toBe(false);
    expect(commands()).toEqual(["app_create_database", "app_cancel_pending_unlock"]);
  });

  it.each([false, true])(
    "relocks invalid resumed data, with close fallback=%s",
    async (fallback) => {
      ipc.mockResolvedValueOnce(databaseTransportFixture().loaded);
      if (fallback) ipc.mockRejectedValueOnce(new Error("test lock failure"));
      else ipc.mockResolvedValueOnce({ phase: "locked" });
      ipc.mockResolvedValueOnce({ phase: "closed" });
      const client = createValidatedDatabaseClient("app", "production", acceptRetainedDocument);
      expect((await client.readDocument()).ok).toBe(false);
      expect(commands()).toEqual([
        "app_read_document",
        "app_lock_database",
        ...(fallback ? ["app_close_database"] : []),
      ]);
    },
  );

  it("blocks unsupported save content without revoking the valid session or invoking save", async () => {
    const current = fixture();
    ipc
      .mockResolvedValueOnce(current.pending)
      .mockResolvedValueOnce(current.session)
      .mockResolvedValueOnce({ revision: 5, session: { ...current.session, revision: 5 } });
    const client = createValidatedDatabaseClient("app", "production", acceptRetainedDocument);
    expect((await client.unlockDatabase({ password: "test" })).ok).toBe(true);
    expect(
      (
        await client.saveDocument({
          serializedDocument: databaseTransportFixture().loaded.serializedDocument,
          expectedRevision: 4,
        })
      ).ok,
    ).toBe(false);
    expect(commands()).toEqual(["app_unlock_database", "app_confirm_unlock"]);
    expect(
      (
        await client.saveDocument({
          serializedDocument: current.loaded.serializedDocument,
          expectedRevision: 4,
        })
      ).ok,
    ).toBe(true);
    expect(commands().slice(-1)).toEqual(["app_save_document"]);
  });

  it("the product composition cannot confirm generic-but-unsupported content", async () => {
    ipc.mockImplementation(async (command) => {
      if (command === "app_database_edition") return "stable";
      if (
        command === "app_get_session_status" ||
        command === "app_cancel_pending_unlock" ||
        command === "app_close_database"
      )
        return { phase: "closed" };
      if (command === "app_open_database") return { session: { phase: "locked" } };
      if (command === "app_unlock_database") return databaseTransportFixture().pending;
      throw new Error(`Unexpected test command: ${command}`);
    });
    const purge = vi.fn();
    const platform = await createTauriDatabaseSessionController({ purgeDocumentResources: purge });
    if (!platform.ok) throw new Error("Expected test platform");
    const { controller } = platform.value;
    await controller.resume();
    await controller.open("test-token");
    expect((await controller.unlock("test")).ok).toBe(false);
    expect(commands()).not.toContain("app_confirm_unlock");
    expect(controller.store.getState().documentWorkspace.document).toBeNull();
    expect(controller.getSnapshot().phase).toBe("closed");
    expect(purge).toHaveBeenCalled();
    await controller.dispose();
  });
});
