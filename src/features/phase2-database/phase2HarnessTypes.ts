import type { DatabaseClient } from "../../platform/database/databaseClient";
import type { SettingsClient } from "../../platform/settings/settingsClient";

export interface Phase2DatabaseHarnessProps {
  readonly databaseClient: DatabaseClient;
  readonly settingsClient: SettingsClient;
  readonly onDismiss: () => void;
}
