import type { PlatformResult } from "../platformErrors";
import type {
  CreateDatabaseRequest,
  DatabaseSession,
  LoadedDocument,
  OpenDatabaseRequest,
  SaveDocumentRequest,
  SavedDocument,
} from "./databaseTypes";
import type { DatabaseSessionId } from "../../domain/ids/entityIds";

export interface DatabaseClient {
  create(request: CreateDatabaseRequest): Promise<PlatformResult<DatabaseSession>>;
  open(request: OpenDatabaseRequest): Promise<PlatformResult<DatabaseSession>>;
  loadDocument(sessionId: DatabaseSessionId): Promise<PlatformResult<LoadedDocument>>;
  saveDocument(request: SaveDocumentRequest): Promise<PlatformResult<SavedDocument>>;
  close(sessionId: DatabaseSessionId): Promise<PlatformResult<void>>;
}
