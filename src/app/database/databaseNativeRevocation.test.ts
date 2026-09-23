import { expect, it } from "vitest";
import {
  sessionSetup,
  unlockTestSession,
  success,
  lockedSession,
  loadedSessionDocument,
} from "./databaseSessionTestSupport";
import { createDeferred } from "../workspace/workspaceTestSupport";
it("revokes synchronously without saving and retains a confirmed locked candidate", async () => {
  const setup = sessionSetup();
  await unlockTestSession(setup);
  setup.client.getSessionStatus.mockResolvedValue(success(lockedSession));
  const result = setup.controller.revokeFromNative();
  expect(setup.controller.store.getState().documentWorkspace.document).toBeNull();
  expect(setup.purge).toHaveBeenCalled();
  expect(setup.client.saveDocument).not.toHaveBeenCalled();
  expect((await result).ok).toBe(true);
  expect(setup.controller.getSnapshot().phase).toBe("locked");
  expect(setup.client.closeDatabase).not.toHaveBeenCalled();
  await setup.controller.dispose();
});
it("rejects pending unlock completion after native revocation and lets explicit cancellation close", async () => {
  const setup = sessionSetup();
  await setup.controller.resume();
  await setup.controller.open("fixture");
  const pending = createDeferred<ReturnType<typeof success<typeof loadedSessionDocument>>>();
  setup.client.unlockDatabase.mockReturnValue(pending.promise);
  const unlock = setup.controller.unlock("fixture");
  await Promise.resolve();
  const revoke = setup.controller.revokeFromNative();
  const cancel = setup.controller.cancel();
  pending.resolve(success(loadedSessionDocument));
  expect((await unlock).ok).toBe(false);
  await Promise.all([revoke, cancel]);
  expect(setup.controller.store.getState().documentWorkspace.document).toBeNull();
  expect(setup.controller.getSnapshot().phase).toBe("closed");
  await setup.controller.dispose();
});
