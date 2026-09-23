// @vitest-environment node
import { expect, it, vi } from "vitest";
import { sessionSetup, unlockTestSession } from "./databaseSessionTestSupport";
import { createDeferred } from "../workspace/workspaceTestSupport";
import type { PlatformResult } from "../../platform/platformErrors";

it("blocks edits while waiting for resource flush and only then purges/locks", async () => {
  const pending = createDeferred<PlatformResult<void>>();
  const flush = vi.fn(() => pending.promise);
  const setup = sessionSetup(undefined, undefined, flush);
  await unlockTestSession(setup);
  const locking = setup.controller.lock();
  await Promise.resolve();
  expect(flush).toHaveBeenCalledTimes(1);
  expect(setup.controller.getSnapshot().busy).toBe(true);
  expect(setup.client.lockDatabase).not.toHaveBeenCalled();
  expect(
    setup.controller.store.workspace.dispatchCommand({
      type: "document.settings.update",
      payload: { settings: { minimapEnabled: false } },
    }).ok,
  ).toBe(false);
  pending.resolve({ ok: true, value: undefined });
  expect((await locking).ok).toBe(true);
  expect(setup.controller.store.getState().documentWorkspace.document).toBeNull();
  expect(setup.client.lockDatabase).toHaveBeenCalledTimes(1);
  await setup.controller.dispose();
});

it("retains unlocked document after failed ordinary resource flush", async () => {
  const flush = vi.fn(async (): Promise<PlatformResult<void>> => ({
    ok: false,
    error: { code: "save_failure", message: "Test failure", retryable: true },
  }));
  const setup = sessionSetup(undefined, undefined, flush);
  await unlockTestSession(setup);
  const before = setup.controller.store.getState().documentWorkspace;
  expect((await setup.controller.lock()).ok).toBe(false);
  expect(setup.controller.store.getState().documentWorkspace).toBe(before);
  expect(setup.controller.getSnapshot()).toMatchObject({ phase: "unlocked", busy: false });
  expect(setup.client.lockDatabase).not.toHaveBeenCalled();
  await setup.controller.dispose();
});
