// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createCommandTestDocument } from "../../domain/commands/commandTestSupport";
import type { DatabasePurpose } from "../../domain/document/documentTypes";
import type { DatabaseClient } from "../../platform/database/databaseClient";
import type { LoadedDocument } from "../../platform/database/databaseTypes";
import {
  FakePersistenceScheduler,
  renameCommand,
  savedDocument,
  unlockedSession,
} from "../workspace/workspaceTestSupport";
import { createDatabaseWorkspace } from "./createDatabaseWorkspace";

function loaded(purpose: DatabasePurpose = "development"): LoadedDocument {
  return {
    serializedDocument: JSON.stringify({
      ...createCommandTestDocument(),
      databasePurpose: purpose,
    }),
    revision: 4,
    session: unlockedSession,
  };
}

function setup(expectedPurpose: DatabasePurpose = "development") {
  const scheduler = new FakePersistenceScheduler();
  const saveDocument = vi.fn<DatabaseClient["saveDocument"]>(async () => savedDocument(5));
  const workspace = createDatabaseWorkspace({
    databaseClient: { saveDocument },
    expectedPurpose,
    scheduler,
  });
  return { ...workspace, scheduler, saveDocument };
}

describe("database workspace admission", () => {
  it.each(["development", "production"] as const)(
    "admits a confirmed %s document without saving",
    (purpose) => {
      const { store, admitLoadedDocument, saveDocument, scheduler } = setup(purpose);
      expect(store.getState().documentWorkspace.document).toBeNull();
      expect(admitLoadedDocument(loaded(purpose))).toEqual({
        ok: true,
        value: { epoch: 1, recoveredFromRevision: null },
      });
      expect(store.getState().documentWorkspace).toMatchObject({
        backendRevision: 4,
        savePhase: "clean",
        localChangeSequence: 0,
        persistedChangeSequence: 0,
        history: { past: [], future: [] },
        autosavePermitted: true,
      });
      expect(scheduler.size).toBe(0);
      expect(saveDocument).not.toHaveBeenCalled();
      store.disposeWorkspace();
    },
  );

  it.each(["closed", "locked", "pending_unlock"] as const)("rejects a %s session", (phase) => {
    const { store, admitLoadedDocument, saveDocument } = setup();
    const before = store.getState().documentWorkspace;
    expect(
      admitLoadedDocument({ ...loaded(), session: { ...unlockedSession, phase } }),
    ).toMatchObject({
      ok: false,
      error: { code: "session_locked" },
    });
    expect(store.getState().documentWorkspace).toBe(before);
    expect(saveDocument).not.toHaveBeenCalled();
    store.disposeWorkspace();
  });

  it.each([
    { sessionId: null },
    { databaseId: "different-database" },
    { documentSchemaVersion: 2 },
    { revision: 3 },
  ])("rejects invalid session metadata %j without loading", (changes) => {
    const { store, admitLoadedDocument } = setup();
    const before = store.getState().documentWorkspace;
    expect(
      admitLoadedDocument({ ...loaded(), session: { ...unlockedSession, ...changes } }).ok,
    ).toBe(false);
    expect(store.getState().documentWorkspace).toBe(before);
    store.disposeWorkspace();
  });

  it.each([-1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid active revision %s",
    (revision) => {
      const { store, admitLoadedDocument } = setup();
      expect(
        admitLoadedDocument({ ...loaded(), revision, session: { ...unlockedSession, revision } })
          .ok,
      ).toBe(false);
      expect(store.getState().documentWorkspace.document).toBeNull();
      store.disposeWorkspace();
    },
  );

  it.each(["development", "production"] as const)(
    "rejects the opposite purpose in %s",
    (purpose) => {
      const { store, admitLoadedDocument } = setup(purpose);
      expect(
        admitLoadedDocument(loaded(purpose === "development" ? "production" : "development")),
      ).toMatchObject({
        ok: false,
        error: { code: "database_purpose_mismatch" },
      });
      expect(store.getState().documentWorkspace.document).toBeNull();
      store.disposeWorkspace();
    },
  );

  it("does not include rejected document content in error messages", () => {
    const { store, admitLoadedDocument } = setup();
    const result = admitLoadedDocument({ ...loaded(), serializedDocument: '{"secret-card-text":' });
    expect(result).toMatchObject({ ok: false, error: { code: "invalid_document_payload" } });
    expect(JSON.stringify(result)).not.toContain("secret-card-text");
    expect(store.getState().documentWorkspace.document).toBeNull();
    store.disposeWorkspace();
  });

  it("preserves active revision for recovered content without automatic repair", () => {
    const { store, admitLoadedDocument, saveDocument, scheduler } = setup();
    expect(admitLoadedDocument({ ...loaded(), recoveredFromRevision: 2 })).toEqual({
      ok: true,
      value: { epoch: 1, recoveredFromRevision: 2 },
    });
    expect(store.getState().documentWorkspace.backendRevision).toBe(4);
    expect(saveDocument).not.toHaveBeenCalled();
    expect(scheduler.size).toBe(0);
    store.disposeWorkspace();
  });

  it.each([-1, 1.5, 4, 5])("rejects invalid recovery revision %s", (recoveredFromRevision) => {
    const { store, admitLoadedDocument } = setup();
    expect(admitLoadedDocument({ ...loaded(), recoveredFromRevision }).ok).toBe(false);
    expect(store.getState().documentWorkspace.document).toBeNull();
    store.disposeWorkspace();
  });

  it("cannot replace an occupied dirty workspace or cancel its pending save", () => {
    const { store, admitLoadedDocument, scheduler } = setup();
    admitLoadedDocument(loaded());
    store.workspace.dispatchCommand(renameCommand("Changed"));
    const before = store.getState().documentWorkspace;
    expect(admitLoadedDocument(loaded())).toMatchObject({
      ok: false,
      error: { code: "session_already_open" },
    });
    expect(store.getState().documentWorkspace).toBe(before);
    expect(scheduler.size).toBe(1);
    store.disposeWorkspace();
  });

  it("uses existing named commands, history and persistence with the admitted backend revision", async () => {
    const { store, admitLoadedDocument, saveDocument } = setup();
    admitLoadedDocument(loaded());
    expect(store.workspace.dispatchCommand(renameCommand("Changed"))).toMatchObject({
      ok: true,
      changed: true,
    });
    expect(store.getState().documentWorkspace.history.past).toHaveLength(1);
    await store.workspace.flushSave();
    expect(saveDocument).toHaveBeenCalledTimes(1);
    expect(saveDocument.mock.calls[0][0]).toMatchObject({ expectedRevision: 4 });
    expect(store.getState().documentWorkspace).toMatchObject({
      backendRevision: 5,
      persistedChangeSequence: 1,
      localChangeSequence: 1,
      savePhase: "clean",
    });
    store.disposeWorkspace();
  });

  it("keeps failed saves dirty and does not permit replacement", async () => {
    const { store, admitLoadedDocument, saveDocument } = setup();
    saveDocument.mockResolvedValueOnce({
      ok: false,
      error: { code: "save_failure", message: "private backend details", retryable: true },
    });
    admitLoadedDocument(loaded());
    store.workspace.dispatchCommand(renameCommand("Unsaved"));
    await store.workspace.flushSave();
    expect(store.getState().documentWorkspace).toMatchObject({
      backendRevision: 4,
      persistedChangeSequence: 0,
      localChangeSequence: 1,
      savePhase: "failed",
    });
    expect(admitLoadedDocument(loaded()).ok).toBe(false);
    store.disposeWorkspace();
  });

  it("admits a new workspace only after explicit clearing", () => {
    const { store, admitLoadedDocument, scheduler } = setup();
    admitLoadedDocument(loaded());
    store.workspace.dispatchCommand(renameCommand("Changed"));
    store.workspace.clear();
    expect(scheduler.size).toBe(0);
    expect(admitLoadedDocument(loaded())).toMatchObject({ ok: true, value: { epoch: 3 } });
    expect(store.getState().documentWorkspace.history.past).toHaveLength(0);
    store.disposeWorkspace();
  });
});
