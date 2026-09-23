import { createTaskMapDocument } from "../../domain/document/createDocument";
import type { DatabasePurpose } from "../../domain/document/documentTypes";
import { createEntityId, type UuidSource } from "../../domain/ids/entityIds";
import { encodeDatabaseDocument } from "../../platform/database/databaseDocumentCodec";
import type { CreateDatabaseRequest } from "../../platform/database/databaseTypes";
import type { PlatformErrorCode, PlatformResult } from "../../platform/platformErrors";

export function createSessionDatabaseRequest(
  authorizationToken: string,
  password: string,
  purpose: DatabasePurpose,
  idSource: UuidSource,
): PlatformResult<CreateDatabaseRequest> {
  const databaseId = createEntityId("database", idSource);
  const document = createTaskMapDocument({ databaseId, databasePurpose: purpose, idSource });
  const encoded = encodeDatabaseDocument(document);
  return encoded.ok
    ? {
        ok: true,
        value: {
          authorizationToken,
          password,
          databaseId,
          documentSchemaVersion: document.schemaVersion,
          serializedDocument: encoded.value,
        },
      }
    : encoded;
}

// Preserve safe categories, never backend details, paths, passwords, or document text.
export function sessionFailure(code: PlatformErrorCode): PlatformResult<never> {
  return {
    ok: false,
    error: {
      code,
      message: "The database session operation could not complete.",
      retryable: false,
    },
  };
}

export const sessionSuccess: PlatformResult<void> = { ok: true, value: undefined };
