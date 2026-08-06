import { invoke } from "@tauri-apps/api/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createPhase2TestDocument } from "../../features/phase2-database/phase2Document";
import { encodeDatabaseDocument } from "./databaseDocumentCodec";
import { tauriDatabaseClient } from "./tauriDatabaseClient";
import type { DatabaseSessionStatus, PendingLoadedDocument } from "./databaseTypes";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const invokeMock = vi.mocked(invoke);
const databaseId = "database-12345678-1234-1234-1234-1234567890ab";
const unlockedSession: DatabaseSessionStatus = {
  phase: "unlocked",
  sessionId: "session-1",
  databasePath: "C:/temp/test.tmapdb",
  databaseId,
  documentSchemaVersion: 1,
  revision: 1,
  lastActivityAt: "1",
};
const pendingSession: DatabaseSessionStatus = { ...unlockedSession, phase: "pending_unlock" };

function validSerializedDocument(purpose: "development" | "production" = "development") {
  const document = createPhase2TestDocument(databaseId, purpose, () => "fixed");
  const encoded = encodeDatabaseDocument(document);
  if (!encoded.ok) throw new Error("test document should encode");
  return encoded.value;
}

function pending(serializedDocument: string): PendingLoadedDocument {
  return {
    serializedDocument,
    revision: 1,
    session: pendingSession,
    confirmationToken: "confirmation-token",
    recoveredFromRevision: null,
    warnings: [],
  };
}

function rawCallPayload(index: number): Record<string, unknown> {
  return JSON.parse(
    new TextDecoder().decode(invokeMock.mock.calls[index]?.[1] as Uint8Array),
  ) as Record<string, unknown>;
}

afterEach(() => vi.clearAllMocks());

describe("tauriDatabaseClient", () => {
  it("maps typed Rust errors without exposing raw failures", async () => {
    invokeMock.mockRejectedValue({
      code: "wrong_password",
      message: "The password is incorrect.",
      retryable: true,
    });

    const result = await tauriDatabaseClient.unlockDatabase({ password: "wrong" });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "wrong_password",
        message: "The password is incorrect.",
        retryable: true,
      },
    });
  });

  it("validates create then confirms the pending Rust session", async () => {
    const serializedDocument = validSerializedDocument();
    invokeMock
      .mockResolvedValueOnce(pending(serializedDocument))
      .mockResolvedValueOnce(unlockedSession);
    const created = await tauriDatabaseClient.createDatabase({
      authorizationToken: "authorized-create-token",
      databaseId,
      documentSchemaVersion: 1,
      serializedDocument,
      password: "temporary",
    });

    expect(created.ok).toBe(true);
    expect(invokeMock.mock.calls.map(([command]) => command)).toEqual([
      "phase2_create_database",
      "phase2_confirm_unlock",
    ]);
    expect(rawCallPayload(0)).toMatchObject({
      databaseId,
      authorizationToken: "authorized-create-token",
    });
    expect(rawCallPayload(1)).toEqual({
      confirmationToken: "confirmation-token",
      databaseId,
      databasePurpose: "development",
    });
  });

  it("cancels pending unlock when TypeScript validation or purpose validation fails", async () => {
    invokeMock
      .mockResolvedValueOnce(pending("not json"))
      .mockResolvedValueOnce({ ...unlockedSession, phase: "closed" });
    const invalid = await tauriDatabaseClient.unlockDatabase({ password: "temporary" });
    expect(invalid).toMatchObject({ ok: false, error: { code: "invalid_document_payload" } });
    expect(invokeMock.mock.calls.map(([command]) => command)).toEqual([
      "phase2_unlock_database",
      "phase2_cancel_pending_unlock",
    ]);

    invokeMock.mockClear();
    const productionDocument = validSerializedDocument("production");
    const rejected = await tauriDatabaseClient.createDatabase({
      authorizationToken: "authorization",
      databaseId,
      documentSchemaVersion: 1,
      serializedDocument: productionDocument,
      password: "temporary",
    });
    expect(rejected).toMatchObject({ ok: false });
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("validates unlocked reads against the envelope identity", async () => {
    invokeMock
      .mockResolvedValueOnce({
        serializedDocument: validSerializedDocument(),
        revision: 1,
        session: { ...unlockedSession, databaseId: "database-other" },
      })
      .mockResolvedValueOnce({ ...unlockedSession, phase: "locked" });

    const result = await tauriDatabaseClient.readDocument();

    expect(result).toMatchObject({ ok: false, error: { code: "invalid_document_payload" } });
    expect(invokeMock.mock.calls.map(([command]) => command)).toEqual([
      "phase2_read_document",
      "phase2_lock_database",
    ]);
  });

  it("falls back to closing when pending cancellation cannot be confirmed", async () => {
    invokeMock
      .mockResolvedValueOnce(pending("not json"))
      .mockRejectedValueOnce(new Error("transport failed"))
      .mockResolvedValueOnce({ ...unlockedSession, phase: "closed" });

    const result = await tauriDatabaseClient.unlockDatabase({ password: "temporary" });

    expect(result).toMatchObject({ ok: false, error: { code: "invalid_document_payload" } });
    expect(invokeMock.mock.calls.map(([command]) => command)).toEqual([
      "phase2_unlock_database",
      "phase2_cancel_pending_unlock",
      "phase2_close_database",
    ]);
  });
});
