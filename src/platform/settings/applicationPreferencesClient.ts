import { invokePlatform, invokePlatformRaw } from "../tauriInvoke";
import type { PlatformResult } from "../platformErrors";
import type { ApplicationEdition } from "./settingsTypes";
import {
  preferencesStateSchema,
  devicePreferencesSchema,
  rememberedViewsSchema,
  type PreferencesState,
  type DevicePreferences,
  type RememberedViews,
  type SessionAuthority,
} from "./preferenceContracts";

const invalid = (): PlatformResult<never> => ({
  ok: false,
  error: {
    code: "invalid_input",
    message: "Preferences or session are invalid.",
    retryable: false,
  },
});
export function createApplicationPreferencesClient(
  edition: ApplicationEdition,
  authority: () => SessionAuthority | null,
) {
  async function preferences(
    result: PlatformResult<unknown>,
  ): Promise<PlatformResult<PreferencesState>> {
    if (!result.ok) return result;
    const parsed = preferencesStateSchema.safeParse(result.value);
    return parsed.success && parsed.data.edition === edition
      ? { ok: true, value: parsed.data }
      : invalid();
  }
  return {
    load: async () => preferences(await invokePlatform("app_load_preferences")),
    async save(expectedRevision: number, value: DevicePreferences) {
      const parsed = devicePreferencesSchema.safeParse(value);
      if (!parsed.success || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0)
        return invalid();
      return preferences(
        await invokePlatformRaw("app_save_preferences", {
          expectedRevision,
          preferences: parsed.data,
        }),
      );
    },
    captureViews() {
      const captured = authority();
      if (!captured) return null;
      const current = () => {
        const now = authority();
        return now?.databaseId === captured.databaseId && now?.sessionId === captured.sessionId;
      };
      return {
        async load(): Promise<PlatformResult<RememberedViews>> {
          if (!current()) return invalid();
          const result = await invokePlatformRaw<unknown>("app_view_state", {
            ...captured,
            value: null,
          });
          if (!current()) return invalid();
          if (!result.ok) return result;
          try {
            if (result.value === null) return { ok: true, value: { version: 1, canvases: {} } };
            if (typeof result.value !== "string" || result.value.length > 128 * 1024)
              return invalid();
            const parsed = rememberedViewsSchema.safeParse(JSON.parse(result.value));
            return parsed.success ? { ok: true, value: parsed.data } : invalid();
          } catch {
            return invalid();
          }
        },
        async save(value: RememberedViews): Promise<PlatformResult<void>> {
          if (!current()) return invalid();
          const parsed = rememberedViewsSchema.safeParse(value);
          if (!parsed.success) return invalid();
          const result = await invokePlatformRaw<null>("app_view_state", {
            ...captured,
            value: JSON.stringify(parsed.data),
          });
          if (!current()) return invalid();
          return result.ok ? { ok: true, value: undefined } : result;
        },
      };
    },
  };
}
export type ApplicationPreferencesClient = ReturnType<typeof createApplicationPreferencesClient>;
