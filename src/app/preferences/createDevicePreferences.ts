import type { ApplicationPreferencesClient } from "../../platform/settings/applicationPreferencesClient";
import {
  devicePreferencesSchema,
  type DevicePreferences,
  type PreferencesState,
} from "../../platform/settings/preferenceContracts";
import type { PlatformResult } from "../../platform/platformErrors";

type PreferencePatch =
  Partial<DevicePreferences> | ((current: DevicePreferences) => Partial<DevicePreferences>);

interface PendingUpdate {
  readonly patch: PreferencePatch;
  readonly parsed: ReturnType<
    ReturnType<typeof devicePreferencesSchema.partial>["safeParse"]
  > | null;
  readonly resolve: (result: PlatformResult<void>) => void;
}

export function createDevicePreferences(client: ApplicationPreferencesClient) {
  let state: PreferencesState | null = null;
  let disposed = false;
  let tail = Promise.resolve<PlatformResult<void>>({ ok: true, value: undefined });
  const listeners = new Set<() => void>();
  // Edits that arrive while a save is running are coalesced into one save: a fast colour drag used
  // to queue hundreds of disk writes that replayed stale values for seconds (and a reload mid-queue
  // left an intermediate value persisted).
  let pending: PendingUpdate[] = [];
  let drainQueued = false;
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
  const drain = async (): Promise<PlatformResult<void>> => {
    drainQueued = false;
    const batch = pending;
    pending = [];
    if (!state || disposed) {
      batch.forEach(({ resolve }) => resolve(failure()));
      return failure();
    }
    let next = state.preferences;
    const accepted: PendingUpdate[] = [];
    for (const item of batch) {
      const update =
        typeof item.patch === "function"
          ? devicePreferencesSchema.partial().strict().safeParse(item.patch(next))
          : item.parsed;
      if (!update?.success) {
        item.resolve(failure());
        continue;
      }
      next = { ...next, ...update.data };
      accepted.push(item);
    }
    if (!accepted.length) return failure();
    const result = await client.save(state.revision, next);
    if (disposed) {
      accepted.forEach(({ resolve }) => resolve(failure()));
      return failure();
    }
    if (!result.ok) {
      // Explicit reload required on conflict; never overwrite silently.
      accepted.forEach(({ resolve }) => resolve(result));
      return result;
    }
    publish(result.value);
    const saved = { ok: true as const, value: undefined };
    accepted.forEach(({ resolve }) => resolve(saved));
    return saved;
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
    update(patch: PreferencePatch) {
      // Copy object patches now; evaluate functional edits against the latest queued revision.
      const parsed =
        typeof patch === "function"
          ? null
          : devicePreferencesSchema.partial().strict().safeParse(patch);
      if ((parsed && !parsed.success) || disposed) return Promise.resolve(failure());
      return new Promise<PlatformResult<void>>((resolve) => {
        pending.push({ patch, parsed, resolve });
        if (drainQueued) return;
        drainQueued = true;
        tail = tail.then(drain).catch(() => failure());
      });
    },
    flush: () => tail,
    dispose() {
      disposed = true;
      state = null;
      listeners.clear();
    },
  };
}
