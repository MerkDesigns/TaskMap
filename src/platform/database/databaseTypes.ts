import type { DatabaseId, DatabaseSessionId } from "../../domain/ids/entityIds";
import type { DatabasePurpose } from "../../domain/document/documentTypes";

export interface OpenDatabaseRequest {
  readonly path: string;
  readonly password: string;
}

export interface CreateDatabaseRequest extends OpenDatabaseRequest {
  readonly purpose: DatabasePurpose;
}

export interface DatabaseSession {
  readonly id: DatabaseSessionId;
  readonly databaseId: DatabaseId;
  readonly path: string;
  readonly purpose: DatabasePurpose;
  readonly revision: number;
}

export interface LoadedDocument {
  readonly payload: Uint8Array;
  readonly revision: number;
}

export interface SaveDocumentRequest {
  readonly sessionId: DatabaseSessionId;
  readonly payload: Uint8Array;
  readonly expectedRevision: number;
}

export interface SavedDocument {
  readonly revision: number;
}
