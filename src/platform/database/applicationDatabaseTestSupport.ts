import { createCommandTestDocument } from "../../domain/commands/commandTestSupport";
import type { DatabasePurpose } from "../../domain/document/documentTypes";
import type { DatabaseSessionStatus, PendingLoadedDocument } from "./databaseTypes";

export function databaseTransportFixture(purpose: DatabasePurpose = "production") {
  const document = { ...createCommandTestDocument(), databasePurpose: purpose };
  const session: DatabaseSessionStatus = {
    phase: "unlocked",
    sessionId: "session-transport-test",
    databasePath: "test.tmapdb",
    databaseId: document.databaseId,
    documentSchemaVersion: 1,
    revision: 4,
    lastActivityAt: "test",
  };
  const loaded = { serializedDocument: JSON.stringify(document), revision: 4, session };
  const pending: PendingLoadedDocument = {
    ...loaded,
    session: { ...session, phase: "pending_unlock" },
    confirmationToken: "pending-token",
  };
  return { document, session, loaded, pending };
}
