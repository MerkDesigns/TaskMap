export type ApplicationEdition = "stable" | "development";
export type DatabasePathMode = "create" | "open" | "full_backup";

export interface AuthorizedDatabasePath {
  readonly authorizationToken: string;
  readonly displayPath: string;
}

export interface RecentDatabaseSettings {
  readonly version: number;
  readonly edition: ApplicationEdition;
  readonly recentDatabases: readonly AuthorizedDatabasePath[];
}
