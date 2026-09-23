import { DEFAULT_ELEMENT_COLORS } from "../../../constants";
import type { ApplicationPreferencesClient } from "../../../platform/settings/applicationPreferencesClient";
import type {
  PreferencesState,
  RememberedViews,
} from "../../../platform/settings/preferenceContracts";

/** In-memory preview transport; no preferences/profile or native authority. */
export function createPreviewPreferencesClient(): ApplicationPreferencesClient {
  let state: PreferencesState = {
    version: 1,
    edition: "development",
    revision: 0,
    preferences: {
      defaultElementColors: { ...DEFAULT_ELEMENT_COLORS },
      recentColors: [],
      toolbarButtonsVisible: false,
      privacyModeEnabled: false,
      dismissedUpdateVersion: null,
    },
  };
  let views: RememberedViews = { version: 1, canvases: {} };
  return {
    load: async () => ({ ok: true, value: state }),
    async save(revision, preferences) {
      if (state.revision !== revision)
        return {
          ok: false,
          error: {
            code: "revision_conflict",
            message: "Preview preferences changed.",
            retryable: true,
          },
        };
      state = { ...state, revision: revision + 1, preferences };
      return { ok: true, value: state };
    },
    captureViews: () => ({
      load: async () => ({ ok: true, value: views }),
      async save(value) {
        views = value;
        return { ok: true, value: undefined };
      },
    }),
  };
}
