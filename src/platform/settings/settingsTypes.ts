export type ApplicationEdition = "stable" | "development";

export interface ApplicationSettings {
  readonly edition: ApplicationEdition;
  readonly recentDatabasePaths: readonly string[];
  readonly updateChecksEnabled: boolean;
  readonly inactivityLockMinutes: number | null;
}

export interface SettingsSnapshot {
  readonly revision: number;
  readonly settings: ApplicationSettings;
}

export interface SaveSettingsRequest {
  readonly expectedRevision: number;
  readonly settings: ApplicationSettings;
}
