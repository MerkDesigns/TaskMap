import type { WindowPrivacyClient } from "../../platform/window/windowPrivacyClient";
import type { createDevicePreferences } from "./createDevicePreferences";
import type { PlatformResult } from "../../platform/platformErrors";

/** Serialize native protection and its preference; never publish a setting before native success. */
export function createWindowPrivacy(
  client: WindowPrivacyClient,
  preferences: ReturnType<typeof createDevicePreferences>,
  revoke: () => void,
) {
  let tail: Promise<PlatformResult<void>> = Promise.resolve({ ok: true, value: undefined });
  let disposed = false;
  const failure = (): PlatformResult<void> => ({
    ok: false,
    error: { code: "unexpected", message: "Window privacy could not be applied.", retryable: true },
  });
  const enqueue = (value?: boolean | ((current: boolean) => boolean)) => {
    tail = tail
      .then(async () => {
        const current = preferences.getSnapshot()?.preferences.privacyModeEnabled;
        if (disposed || current === undefined) return failure();
        const enabled =
          value === undefined ? current : typeof value === "function" ? value(current) : value;
        const applied = await client.setProtected(enabled);
        if (disposed) return failure();
        if (!applied.ok) {
          revoke();
          return applied;
        }
        if (value === undefined) return applied;
        const saved = await preferences.update({ privacyModeEnabled: enabled });
        if (!saved.ok && !disposed) revoke();
        return saved;
      })
      .catch(() => {
        if (!disposed) revoke();
        return failure();
      });
    return tail;
  };
  return {
    initialize: () => enqueue(),
    update: (value: boolean | ((current: boolean) => boolean)) => enqueue(value),
    dispose() {
      disposed = true;
    },
  };
}
