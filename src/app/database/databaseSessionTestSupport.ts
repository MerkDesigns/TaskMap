import { vi } from "vitest";
import { createCommandTestDocument } from "../../domain/commands/commandTestSupport";
import type { DatabaseClient } from "../../platform/database/databaseClient";
import type { DatabaseSessionStatus, LoadedDocument } from "../../platform/database/databaseTypes";
import type { PlatformResult } from "../../platform/platformErrors";
import {
  FakePersistenceScheduler,
  savedDocument,
  unlockedSession,
} from "../workspace/workspaceTestSupport";
import { createDatabaseSessionController } from "./createDatabaseSessionController";
import type { DocumentAcceptance } from "../../domain/document/documentAcceptance";
import type { DomainCommandHandler } from "../../domain/commands/commandHandler";

export const loadedSessionDocument: LoadedDocument = {
  serializedDocument: JSON.stringify({
    ...createCommandTestDocument(),
    databasePurpose: "development",
  }),
  revision: 4,
  session: unlockedSession,
};
export const closedSession: DatabaseSessionStatus = {
  phase: "closed",
  sessionId: null,
  databasePath: null,
  databaseId: null,
  documentSchemaVersion: null,
  revision: null,
  lastActivityAt: null,
};
export const lockedSession = { ...unlockedSession, phase: "locked" as const };
export function success<T>(value: T): PlatformResult<T> {
  return { ok: true, value };
}

export function sessionSetup(
  acceptDocument?: DocumentAcceptance,
  commandHandlers?: readonly DomainCommandHandler[],
  flushDocumentResources?: () => Promise<PlatformResult<void>>,
) {
  const client = {
    createDatabase: vi.fn<DatabaseClient["createDatabase"]>(async (request) =>
      success({
        serializedDocument: request.serializedDocument,
        revision: 0,
        session: { ...unlockedSession, databaseId: request.databaseId, revision: 0 },
      }),
    ),
    openDatabase: vi.fn<DatabaseClient["openDatabase"]>(async () =>
      success({ session: lockedSession, warnings: [] }),
    ),
    unlockDatabase: vi.fn<DatabaseClient["unlockDatabase"]>(async () =>
      success(loadedSessionDocument),
    ),
    readDocument: vi.fn<DatabaseClient["readDocument"]>(async () => success(loadedSessionDocument)),
    saveDocument: vi.fn<DatabaseClient["saveDocument"]>(async () => savedDocument(5)),
    fullBackup: vi.fn<DatabaseClient["fullBackup"]>(async () => success(undefined)),
    lockDatabase: vi.fn<DatabaseClient["lockDatabase"]>(async () => success(lockedSession)),
    closeDatabase: vi.fn<DatabaseClient["closeDatabase"]>(async () => success(closedSession)),
    getSessionStatus: vi.fn<DatabaseClient["getSessionStatus"]>(async () => success(closedSession)),
    quitApplication: vi.fn<DatabaseClient["quitApplication"]>(async () => success(undefined)),
  };
  const purge = vi.fn();
  const scheduler = new FakePersistenceScheduler();
  const controller = createDatabaseSessionController({
    flushDocumentResources,
    commandHandlers,
    acceptDocument,
    databaseClient: client,
    expectedPurpose: "development",
    scheduler,
    purgeDocumentResources: purge,
  });
  return { controller, client, purge, scheduler };
}

export async function unlockTestSession(setup: ReturnType<typeof sessionSetup>) {
  await setup.controller.resume();
  await setup.controller.open("test-path-token");
  await setup.controller.unlock("test-only-password");
}
