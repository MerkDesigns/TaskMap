import type { PlatformResult } from "../platformErrors";
import type { SaveSettingsRequest, SettingsSnapshot } from "./settingsTypes";

export interface SettingsClient {
  load(): Promise<PlatformResult<SettingsSnapshot>>;
  save(request: SaveSettingsRequest): Promise<PlatformResult<SettingsSnapshot>>;
}
