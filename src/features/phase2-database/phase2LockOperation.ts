import type { TaskMapDocument } from "../../domain/document/documentTypes";
import type { DatabaseClient } from "../../platform/database/databaseClient";
import { encodeDatabaseDocument } from "../../platform/database/databaseDocumentCodec";
import type { DatabaseSessionStatus } from "../../platform/database/databaseTypes";
import type { PlatformResult } from "../../platform/platformErrors";

export async function saveThenLockPhase2Document(
  databaseClient: Pick<DatabaseClient, "saveDocument" | "lockDatabase">,
  document: TaskMapDocument | null,
  revision: number | null,
): Promise<PlatformResult<DatabaseSessionStatus>> {
  if (document && revision !== null) {
    const encoded = encodeDatabaseDocument(document);
    if (!encoded.ok) return encoded;
    const saved = await databaseClient.saveDocument({
      serializedDocument: encoded.value,
      expectedRevision: revision,
    });
    if (!saved.ok) return saved;
  }
  return databaseClient.lockDatabase();
}
