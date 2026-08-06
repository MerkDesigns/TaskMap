import { describe, expect, it, vi } from "vitest";
import type { DatabaseClient } from "../../platform/database/databaseClient";
import type { DatabaseSessionStatus } from "../../platform/database/databaseTypes";
import { createPhase2TestDocument } from "./phase2Document";
import { saveThenLockPhase2Document } from "./phase2LockOperation";

const unlocked: DatabaseSessionStatus = {
  phase: "unlocked",
  sessionId: "session",
  databasePath: "test.tmapdb",
  databaseId: "database",
  documentSchemaVersion: 1,
  revision: 1,
  lastActivityAt: "1",
};

describe("saveThenLockPhase2Document", () => {
  it("saves the current document before locking", async () => {
    const calls: string[] = [];
    const saveDocument = vi.fn(async () => {
      calls.push("save");
      return { ok: true as const, value: { revision: 2, session: { ...unlocked, revision: 2 } } };
    });
    const lockDatabase = vi.fn(async () => {
      calls.push("lock");
      return { ok: true as const, value: { ...unlocked, phase: "locked" as const } };
    });
    const client = { saveDocument, lockDatabase } satisfies Pick<
      DatabaseClient,
      "saveDocument" | "lockDatabase"
    >;

    const result = await saveThenLockPhase2Document(
      client,
      createPhase2TestDocument(
        "database-00000000-0000-4000-8000-000000000001",
        "development",
        () => "00000000-0000-4000-8000-000000000001",
      ),
      1,
    );

    expect(result.ok).toBe(true);
    expect(calls).toEqual(["save", "lock"]);
  });

  it("does not lock when the pending save fails", async () => {
    const saveDocument = vi.fn(async () => ({
      ok: false as const,
      error: { code: "save_failure" as const, message: "Save failed.", retryable: true },
    }));
    const lockDatabase = vi.fn();

    const result = await saveThenLockPhase2Document(
      { saveDocument, lockDatabase },
      createPhase2TestDocument(
        "database-00000000-0000-4000-8000-000000000001",
        "development",
        () => "00000000-0000-4000-8000-000000000001",
      ),
      1,
    );

    expect(result).toMatchObject({ ok: false, error: { code: "save_failure" } });
    expect(lockDatabase).not.toHaveBeenCalled();
  });
});
