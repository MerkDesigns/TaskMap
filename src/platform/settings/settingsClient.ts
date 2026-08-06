import type { PlatformResult } from "../platformErrors";
import type {
  AuthorizedDatabasePath,
  DatabasePathMode,
  RecentDatabaseSettings,
} from "./settingsTypes";

export interface SettingsClient {
  chooseDatabasePath(
    mode: DatabasePathMode,
  ): Promise<PlatformResult<AuthorizedDatabasePath | null>>;
  listRecentDatabases(): Promise<PlatformResult<RecentDatabaseSettings>>;
}
