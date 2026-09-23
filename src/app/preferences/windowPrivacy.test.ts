import { expect, it, vi } from "vitest";
import { createWindowPrivacy } from "./createWindowPrivacy";
import { createDevicePreferences } from "./createDevicePreferences";
import { preferencesClientFixture } from "./preferencesTestSupport";
import type { WindowPrivacyClient } from "../../platform/window/windowPrivacyClient";
import { createDeferred } from "../workspace/workspaceTestSupport";
import type { PlatformResult } from "../../platform/platformErrors";

const failed = {
  ok: false as const,
  error: { code: "unexpected" as const, message: "Fixture failure", retryable: true },
};
async function setup() {
  const { client } = preferencesClientFixture();
  const preferences = createDevicePreferences(client);
  await preferences.load();
  const window = {
    setProtected: vi.fn<WindowPrivacyClient["setProtected"]>(async () => ({
      ok: true,
      value: undefined,
    })),
  };
  const revoke = vi.fn();
  return {
    client,
    preferences,
    window,
    revoke,
    privacy: createWindowPrivacy(window, preferences, revoke),
  };
}
it("applies protection before persisting and serializes rapid toggles against the saved value", async () => {
  const s = await setup();
  const pending = createDeferred<PlatformResult<void>>();
  s.window.setProtected.mockReturnValueOnce(pending.promise);
  const first = s.privacy.update(true);
  const second = s.privacy.update((current) => !current);
  await Promise.resolve();
  expect(s.client.save).not.toHaveBeenCalled();
  pending.resolve({ ok: true, value: undefined });
  expect((await first).ok).toBe(true);
  expect((await second).ok).toBe(true);
  expect(s.window.setProtected.mock.calls.map(([value]) => value)).toEqual([true, false]);
  expect(s.preferences.getSnapshot()!.preferences.privacyModeEnabled).toBe(false);
  expect(s.revoke).not.toHaveBeenCalled();
});
it.each(["native", "save"])(
  "revokes the view if %s fails without reporting successful privacy",
  async (kind) => {
    const s = await setup();
    if (kind === "native") s.window.setProtected.mockResolvedValue(failed);
    else s.client.save.mockResolvedValue(failed);
    expect((await s.privacy.update(true)).ok).toBe(false);
    expect(s.preferences.getSnapshot()!.preferences.privacyModeEnabled).toBe(false);
    expect(s.revoke).toHaveBeenCalledTimes(1);
  },
);
it("initializes a saved preference without a new save and ignores a disposed completion", async () => {
  const s = await setup();
  await s.preferences.update({ privacyModeEnabled: true });
  s.client.save.mockClear();
  expect((await s.privacy.initialize()).ok).toBe(true);
  expect(s.window.setProtected).toHaveBeenCalledWith(true);
  expect(s.client.save).not.toHaveBeenCalled();
  const pending = createDeferred<PlatformResult<void>>();
  s.window.setProtected.mockReturnValue(pending.promise);
  const change = s.privacy.update(false);
  await Promise.resolve();
  s.privacy.dispose();
  pending.resolve({ ok: true, value: undefined });
  expect((await change).ok).toBe(false);
  expect(s.client.save).not.toHaveBeenCalled();
});
