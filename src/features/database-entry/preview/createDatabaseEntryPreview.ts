import { createApplicationDatabaseRuntime } from "../../../app/database/createApplicationDatabaseRuntime";
import { createPreviewPreferencesClient } from "./createPreviewPreferencesClient";
import { createPreviewMediaClient } from "./createPreviewMediaClient";
import type { WindowPrivacyClient } from "../../../platform/window/windowPrivacyClient";

import { createTaskMapDocument } from "../../../domain/document/createDocument";
import { asEntityId } from "../../../domain/ids/entityIds";
import type { DatabaseClient } from "../../../platform/database/databaseClient";
import type {
  DatabaseSessionStatus,
  LoadedDocument,
} from "../../../platform/database/databaseTypes";
import type { PlatformResult } from "../../../platform/platformErrors";

// In-memory transport only: this fixture cannot invoke native databases, preferences or keyring.
export function createDatabaseEntryPreview(windowPrivacyClient?: WindowPrivacyClient) {
  const ok = <T>(value: T): PlatformResult<T> => ({ ok: true, value });
  const closed: DatabaseSessionStatus = {
    phase: "closed",
    sessionId: null,
    databaseId: null,
    databasePath: null,
    documentSchemaVersion: null,
    revision: null,
    lastActivityAt: null,
  };
  let status = closed;
  const media = createPreviewMediaClient(() =>
    status.phase === "unlocked" ? status.sessionId : null,
  );
  let storedRevision = 0;
  let recovered = false;
  let databaseId = asEntityId("database", `database-${crypto.randomUUID()}`);
  let serializedDocument = JSON.stringify(
    createTaskMapDocument({
      databaseId,
      databasePurpose: "development",
      idSource: { nextUuid: () => crypto.randomUUID() },
    }),
  );
  const loaded = (): LoadedDocument => ({
    serializedDocument,
    revision: status.revision ?? 0,
    session: status,
    recoveredFromRevision: recovered ? 0 : null,
  });
  const client: DatabaseClient = {
    async getSessionStatus() {
      return ok(status);
    },
    async createDatabase(request) {
      media.clear();
      recovered = false;
      storedRevision = 0;
      databaseId = asEntityId("database", request.databaseId);
      serializedDocument = request.serializedDocument;
      status = {
        ...closed,
        phase: "unlocked",
        sessionId: `database-session-${crypto.randomUUID()}`,
        databaseId: request.databaseId,
        databasePath: "Preview database.tmapdb",
        documentSchemaVersion: 1,
        revision: 0,
      };
      return ok(loaded());
    },
    async openDatabase(request) {
      recovered = request.authorizationToken === "recovered-preview-token";
      status = {
        ...closed,
        phase: "locked",
        databaseId,
        databasePath: "Preview database.tmapdb",
        documentSchemaVersion: 1,
        revision: recovered ? Math.max(1, storedRevision) : storedRevision,
      };
      return ok({ session: status, warnings: [] });
    },
    async unlockDatabase({ password }) {
      if (password === "wrong")
        return {
          ok: false,
          error: { code: "wrong_password", message: "Preview rejection", retryable: true },
        };
      status = {
        ...status,
        phase: "unlocked",
        sessionId: `database-session-${crypto.randomUUID()}`,
      };
      return ok(loaded());
    },
    async readDocument() {
      return ok(loaded());
    },
    async saveDocument(request) {
      serializedDocument = request.serializedDocument;
      storedRevision = request.expectedRevision + 1;
      status = { ...status, revision: storedRevision };
      return ok({ revision: status.revision!, session: status });
    },
    async fullBackup() {
      return ok(undefined);
    },
    async lockDatabase() {
      status = { ...status, phase: "locked", sessionId: null };
      return ok(status);
    },
    async closeDatabase() {
      status = closed;
      return ok(status);
    },
    async quitApplication() {
      status = closed;
      return ok(undefined);
    },
  };
  const runtime = createApplicationDatabaseRuntime(
    {
      edition: "development",
      expectedPurpose: "development",
      databaseClient: {
        ...client,
        getSessionAuthority: () =>
          status.phase === "unlocked" && status.sessionId && status.databaseId
            ? { sessionId: status.sessionId, databaseId: status.databaseId }
            : null,
      },
      preferencesClient: createPreviewPreferencesClient(),
      mediaClient: media.client,
      settingsClient: {
        async chooseDatabasePath() {
          return ok({
            authorizationToken: crypto.randomUUID(),
            displayPath: "Preview database.tmapdb",
          });
        },
        async listRecentDatabases() {
          return ok({
            version: 1,
            edition: "development",
            recentDatabases: [
              { authorizationToken: crypto.randomUUID(), displayPath: "Preview database.tmapdb" },
              {
                authorizationToken: "recovered-preview-token",
                displayPath: "Recovered preview.tmapdb",
              },
            ],
          });
        },
      },
    },
    { purgeDocumentResources() {}, windowPrivacyClient },
  ).value;
  return {
    ...runtime,
    forceLockPreview() {
      status = { ...status, phase: "locked", sessionId: null };
      return runtime.controller.revokeFromNative();
    },
  };
}
