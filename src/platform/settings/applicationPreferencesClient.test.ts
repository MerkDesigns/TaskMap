// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { createApplicationPreferencesClient } from "./applicationPreferencesClient";
import { invokePlatform, invokePlatformRaw } from "../tauriInvoke";
import { preferencesFixture } from "../../app/preferences/preferencesTestSupport";
vi.mock("../tauriInvoke", () => ({ invokePlatform: vi.fn(), invokePlatformRaw: vi.fn() }));
const raw = vi.mocked(invokePlatformRaw),
  invoke = vi.mocked(invokePlatform);
beforeEach(() => {
  raw.mockReset();
  invoke.mockReset();
});
it("checks edition and preference types before accepting native state", async () => {
  const client = createApplicationPreferencesClient("development", () => null);
  invoke.mockResolvedValue({ ok: true, value: preferencesFixture() });
  expect((await client.load()).ok).toBe(true);
  invoke.mockResolvedValue({ ok: true, value: { ...preferencesFixture(), edition: "stable" } });
  expect((await client.load()).ok).toBe(false);
  expect(
    (await client.save(0, { ...preferencesFixture().preferences, recentColors: ["invalid"] })).ok,
  ).toBe(false);
  expect(raw).not.toHaveBeenCalled();
});
it("matches native control-character and UTF-8 version limits before IPC", async () => {
  const client = createApplicationPreferencesClient("development", () => null);
  for (const version of ["\u0085", "é".repeat(65)]) {
    expect(
      (
        await client.save(0, {
          ...preferencesFixture().preferences,
          dismissedUpdateVersion: version,
        })
      ).ok,
    ).toBe(false);
  }
  expect(raw).not.toHaveBeenCalled();
});
it("rejects obsolete view-session handles and malformed/foreign camera payloads", async () => {
  let sessionId = "first";
  const client = createApplicationPreferencesClient("development", () => ({
    databaseId: "database-test",
    sessionId,
  }));
  const first = client.captureViews()!;
  sessionId = "second";
  expect((await first.load()).ok).toBe(false);
  expect(raw).not.toHaveBeenCalled();
  raw.mockResolvedValue({ ok: true, value: '{"version":1,"canvases":{"bad-id":{"zoom":1}}}' });
  expect((await client.captureViews()!.load()).ok).toBe(false);
  expect(
    (await client.captureViews()!.save({ version: 1, canvases: {}, document: {} } as never)).ok,
  ).toBe(false);
  expect(raw).toHaveBeenCalledTimes(1);
});
