export type DatabaseSessionPhase = "closed" | "locked" | "pending_unlock" | "unlocked";

export interface DatabaseSessionStatus {
  readonly phase: DatabaseSessionPhase;
  readonly sessionId: string | null;
  readonly databasePath: string | null;
  readonly databaseId: string | null;
  readonly documentSchemaVersion: number | null;
  readonly revision: number | null;
  readonly lastActivityAt: string | null;
}

export interface CreateDatabaseRequest {
  readonly authorizationToken: string;
  readonly databaseId: string;
  readonly documentSchemaVersion: number;
  readonly serializedDocument: string;
  readonly password: string;
}

export interface OpenDatabaseRequest {
  readonly authorizationToken: string;
}

export interface UnlockDatabaseRequest {
  readonly password: string;
}

export interface LoadedDocument {
  readonly serializedDocument: string;
  readonly revision: number;
  readonly session: DatabaseSessionStatus;
  readonly recoveredFromRevision?: number | null;
  readonly warnings?: readonly string[];
}

export interface PendingLoadedDocument extends LoadedDocument {
  readonly confirmationToken: string;
}

export interface SessionOperation {
  readonly session: DatabaseSessionStatus;
  readonly warnings: readonly string[];
}

export interface SaveDocumentRequest {
  readonly serializedDocument: string;
  readonly expectedRevision: number;
}

export interface SavedDocument {
  readonly revision: number;
  readonly session: DatabaseSessionStatus;
}
