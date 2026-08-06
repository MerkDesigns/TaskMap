import type { SettingsClient } from "../../platform/settings/settingsClient";
import type {
  AuthorizedDatabasePath,
  RecentDatabaseSettings,
} from "../../platform/settings/settingsTypes";

interface Phase2DatabasePathControlsProps {
  readonly busy: boolean;
  readonly selected: AuthorizedDatabasePath | null;
  readonly recent: RecentDatabaseSettings | null;
  readonly settingsClient: SettingsClient;
  readonly onFailure: (message: string) => void;
  readonly onPathChanged: (path: AuthorizedDatabasePath | null) => void;
}

export function Phase2DatabasePathControls({
  busy,
  selected,
  recent,
  settingsClient,
  onFailure,
  onPathChanged,
}: Phase2DatabasePathControlsProps) {
  const choose = async (mode: "create" | "open") => {
    const result = await settingsClient.chooseDatabasePath(mode);
    if (result.ok) onPathChanged(result.value);
    else onFailure(result.error.message);
  };

  return (
    <>
      <div className="phase2-harness-row">
        <input aria-label="Database path" value={selected?.displayPath ?? ""} readOnly />
        <button type="button" disabled={busy} onClick={() => void choose("create")}>
          Choose new
        </button>
        <button type="button" disabled={busy} onClick={() => void choose("open")}>
          Choose existing
        </button>
      </div>

      {recent && recent.recentDatabases.length > 0 && (
        <div className="phase2-harness-row">
          <select
            aria-label="Recent databases"
            value=""
            onChange={(event) => {
              const selectedRecent = recent.recentDatabases.find(
                (item) => item.authorizationToken === event.target.value,
              );
              onPathChanged(selectedRecent ?? null);
            }}
          >
            <option value="">Recent databases</option>
            {recent.recentDatabases.map((item) => (
              <option key={item.authorizationToken} value={item.authorizationToken}>
                {item.displayPath}
              </option>
            ))}
          </select>
        </div>
      )}
    </>
  );
}

export async function refreshPhase2RecentDatabases(
  settingsClient: SettingsClient,
  update: (settings: RecentDatabaseSettings) => void,
) {
  const result = await settingsClient.listRecentDatabases();
  if (result.ok) update(result.value);
}
