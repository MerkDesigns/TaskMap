import { invokePlatform, invokePlatformRaw } from "../tauriInvoke";
import type { SettingsClient } from "./settingsClient";
import type { AuthorizedDatabasePath, RecentDatabaseSettings } from "./settingsTypes";

export const tauriSettingsClient: SettingsClient = {
  chooseDatabasePath(mode) {
    return invokePlatformRaw<AuthorizedDatabasePath | null>("phase2_choose_database_path", {
      mode,
    });
  },

  listRecentDatabases() {
    return invokePlatform<RecentDatabaseSettings>("phase2_list_recent_databases");
  },
};
