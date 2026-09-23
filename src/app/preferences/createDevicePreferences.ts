import type { ApplicationPreferencesClient } from "../../platform/settings/applicationPreferencesClient";
import {
  devicePreferencesSchema,
  type DevicePreferences,
  type PreferencesState,
} from "../../platform/settings/preferenceContracts";
import type { PlatformResult } from "../../platform/platformErrors";

export function createDevicePreferences(client: ApplicationPreferencesClient) {
  let state: PreferencesState | null = null;
  let disposed = false;
  let tail = Promise.resolve<PlatformResult<void>>({ ok: true, value: undefined });
  const listeners = new Set<() => void>();
  const failure = (): PlatformResult<never> => ({
    ok: false,
    error: { code: "invalid_input", message: "Preferences are not ready.", retryable: false },
  });
  const publish = (value: PreferencesState) => {
    Object.freeze(value.preferences.defaultElementColors);
    Object.freeze(value.preferences.recentColors);
    Object.freeze(value.preferences);
    Object.freeze(value);
    state = value;
    listeners.forEach((listener) => {
      try {
        listener();
      } catch {
        /* A view observer cannot undo a successful preferences save. */
      }
    });
  };
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    load() {
      tail = tail
        .then(async () => {
          if (disposed) return failure();
          const result = await client.load();
          if (disposed) return failure();
          if (result.ok) publish(result.value);
          return result.ok ? { ok: true as const, value: undefined } : result;
        })
        .catch(() => failure());
      return tail;
    },
    update(
      patch:
        Partial<DevicePreferences> | ((current: DevicePreferences) => Partial<DevicePreferences>),
    ) {
      // Copy object patches now; evaluate functional edits against the latest queued revision.
      const parsed =
        typeof patch === "function"
          ? null
          : devicePreferencesSchema.partial().strict().safeParse(patch);
      if ((parsed && !parsed.success) || disposed) return Promise.resolve(failure());
      tail = tail
        .then(async () => {
          if (!state || disposed) return failure();
          const update =
            typeof patch === "function"
              ? devicePreferencesSchema.partial().strict().safeParse(patch(state.preferences))
              : parsed;
          if (!update?.success) return failure();
          const result = await client.save(state.revision, {
            ...state.preferences,
            ...update.data,
          });
          if (disposed) return failure();
          if (!result.ok) return result; // Explicit reload required on conflict; never overwrite silently.
          publish(result.value);
          return { ok: true as const, value: undefined };
        })
        .catch(() => failure());
      return tail;
    },
    flush: () => tail,
    dispose() {
      disposed = true;
      state = null;
      listeners.clear();
    },
  };
}
