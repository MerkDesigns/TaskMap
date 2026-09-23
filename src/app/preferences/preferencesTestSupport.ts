import { vi } from "vitest";
import type { ApplicationPreferencesClient } from "../../platform/settings/applicationPreferencesClient";
import type { PreferencesState } from "../../platform/settings/preferenceContracts";
export const preferencesFixture = (): PreferencesState => ({
  version: 1,
  edition: "development",
  revision: 0,
  preferences: {
    defaultElementColors: {
      container: "#476FA8",
      textCard: "#476FA8",
      textBlock: "#476FA8",
      image: "#476FA8",
      mindmap: "#476FA8",
    },
    recentColors: [],
    privacyModeEnabled: false,
    toolbarButtonsVisible: true,
    dismissedUpdateVersion: null,
  },
});
export function preferencesClientFixture() {
  const view = {
    load: vi.fn(async () => ({ ok: true as const, value: { version: 1 as const, canvases: {} } })),
    save: vi.fn(async () => ({ ok: true as const, value: undefined })),
  };
  const client = {
    load: vi.fn(async () => ({ ok: true as const, value: preferencesFixture() })),
    save: vi.fn<ApplicationPreferencesClient["save"]>(async (revision, preferences) => ({
      ok: true,
      value: { version: 1, edition: "development", revision: revision + 1, preferences },
    })),
    captureViews: vi.fn(() => view),
  } satisfies ApplicationPreferencesClient;
  return { client, view };
}
