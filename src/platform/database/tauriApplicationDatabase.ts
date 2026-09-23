import { invokePlatform, invokePlatformRaw } from "../tauriInvoke";
import type { PlatformResult } from "../platformErrors";
import type {
  ApplicationEdition,
  AuthorizedDatabasePath,
  RecentDatabaseSettings,
} from "../settings/settingsTypes";
import type { SettingsClient } from "../settings/settingsClient";
import { createValidatedDatabaseClient } from "./createValidatedDatabaseClient";
import type { DocumentAcceptance } from "../../domain/document/documentAcceptance";
import { createApplicationPreferencesClient } from "../settings/applicationPreferencesClient";
import {
  createApplicationMediaClient,
  type ApplicationMediaClient,
} from "../media/applicationMediaClient";

const settingsClient: SettingsClient = {
  chooseDatabasePath: (mode) =>
    invokePlatformRaw<AuthorizedDatabasePath | null>("app_choose_database_path", { mode }),
  listRecentDatabases: () => invokePlatform<RecentDatabaseSettings>("app_list_recent_databases"),
};

/** Explicit factory; importing this module never accesses IPC or opens a file. */
export async function createTauriApplicationDatabase(acceptDocument: DocumentAcceptance) {
  const result = await invokePlatform<ApplicationEdition>("app_database_edition");
  if (!result.ok) return result;
  if (result.value !== "stable" && result.value !== "development") {
    return {
      ok: false as const,
      error: {
        code: "permission_denied" as const,
        message: "This application edition cannot access databases.",
        retryable: false,
      },
    };
  }
  const expectedPurpose =
    result.value === "stable" ? ("production" as const) : ("development" as const);
  const databaseClient = createValidatedDatabaseClient("app", expectedPurpose, acceptDocument);
  const value = {
    edition: result.value,
    expectedPurpose,
    databaseClient,
    preferencesClient: createApplicationPreferencesClient(
      result.value,
      databaseClient.getSessionAuthority,
    ),
    mediaClient: createApplicationMediaClient(
      databaseClient.getSessionAuthority,
    ) as ApplicationMediaClient,
    settingsClient,
  };
  return { ok: true, value } as PlatformResult<typeof value>;
}
