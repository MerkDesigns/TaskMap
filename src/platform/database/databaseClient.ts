import type { PlatformResult } from "../platformErrors";
import type {
  CreateDatabaseRequest,
  DatabaseSessionStatus,
  LoadedDocument,
  OpenDatabaseRequest,
  SaveDocumentRequest,
  SavedDocument,
  UnlockDatabaseRequest,
  SessionOperation,
} from "./databaseTypes";

export interface DatabaseClient {
  createDatabase(request: CreateDatabaseRequest): Promise<PlatformResult<LoadedDocument>>;
  openDatabase(request: OpenDatabaseRequest): Promise<PlatformResult<SessionOperation>>;
  unlockDatabase(request: UnlockDatabaseRequest): Promise<PlatformResult<LoadedDocument>>;
  readDocument(): Promise<PlatformResult<LoadedDocument>>;
  saveDocument(request: SaveDocumentRequest): Promise<PlatformResult<SavedDocument>>;
  fullBackup(authorizationToken: string): Promise<PlatformResult<void>>;
  lockDatabase(): Promise<PlatformResult<DatabaseSessionStatus>>;
  closeDatabase(): Promise<PlatformResult<DatabaseSessionStatus>>;
  getSessionStatus(): Promise<PlatformResult<DatabaseSessionStatus>>;
  quitApplication(): Promise<PlatformResult<void>>;
}
