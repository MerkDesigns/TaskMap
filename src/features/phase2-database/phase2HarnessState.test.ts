import { describe, expect, it } from "vitest";
import { createAppStore } from "../../app/store";
import type { DatabaseSessionStatus } from "../../platform/database/databaseTypes";
import { createPhase2TestDocument } from "./phase2Document";
import { INITIAL_PHASE2_HARNESS_STATE, phase2HarnessReducer } from "./phase2HarnessState";

const unlocked: DatabaseSessionStatus = {
  phase: "unlocked",
  sessionId: "session",
  databasePath: "test.tmapdb",
  databaseId: "database",
  documentSchemaVersion: 1,
  revision: 1,
  lastActivityAt: "1",
};

describe("Phase 2 frontend state", () => {
  it("never stores a password-shaped field in Redux", () => {
    const serializedState = JSON.stringify(createAppStore().getState()).toLowerCase();
    expect(serializedState).not.toContain("password");
  });

  it("purges the decrypted document on lock and follows session transitions", () => {
    const document = createPhase2TestDocument(
      "database-00000000-0000-4000-8000-000000000001",
      "development",
      () => "00000000-0000-4000-8000-000000000001",
    );
    const loaded = phase2HarnessReducer(INITIAL_PHASE2_HARNESS_STATE, {
      type: "documentReceived",
      session: unlocked,
      document,
    });
    expect(loaded.document).toBe(document);

    const locked = phase2HarnessReducer(loaded, {
      type: "sessionReceived",
      session: { ...unlocked, phase: "locked" },
    });
    expect(locked.session.phase).toBe("locked");
    expect(locked.document).toBeNull();

    const closed = phase2HarnessReducer(locked, {
      type: "sessionReceived",
      session: {
        phase: "closed",
        sessionId: null,
        databasePath: null,
        databaseId: null,
        documentSchemaVersion: null,
        revision: null,
        lastActivityAt: null,
      },
    });
    expect(closed.session.phase).toBe("closed");
    expect(closed.document).toBeNull();
  });
});
