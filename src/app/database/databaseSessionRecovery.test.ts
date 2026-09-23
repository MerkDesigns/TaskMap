// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  renameCommand,
  savedDocument,
  settlePersistenceContinuations,
} from "../workspace/workspaceTestSupport";
import {
  loadedSessionDocument,
  lockedSession,
  sessionSetup,
  success,
  unlockTestSession,
} from "./databaseSessionTestSupport";

describe("database session recovery boundaries", () => {
  it.each(["session_locked", "session_not_open"] as const)(
    "revokes idle autosave access after %s without a manual transition",
    async (code) => {
      const setup = sessionSetup();
      await unlockTestSession(setup);
      setup.client.saveDocument.mockResolvedValue({
        ok: false,
        error: { code, message: "private", retryable: false },
      });
      setup.controller.store.workspace.dispatchCommand(renameCommand("Changed"));
      setup.scheduler.runNext();
      await settlePersistenceContinuations();
      expect(setup.controller.store.getState().documentWorkspace.document).toBeNull();
      expect(setup.purge).toHaveBeenCalled();
      expect(setup.client.closeDatabase).toHaveBeenCalledTimes(1);
      expect(setup.controller.getSnapshot()).toMatchObject({ phase: "closed", busy: false });
    },
  );
  it("retries an ordinary failed save before allowing close", async () => {
    const setup = sessionSetup();
    await unlockTestSession(setup);
    setup.client.saveDocument.mockResolvedValueOnce({
      ok: false,
      error: { code: "save_failure", message: "private", retryable: true },
    });
    setup.controller.store.workspace.dispatchCommand(renameCommand("Changed"));
    expect((await setup.controller.close()).ok).toBe(false);
    setup.client.saveDocument.mockResolvedValue(savedDocument(5));
    expect((await setup.controller.retrySave()).ok).toBe(true);
    expect((await setup.controller.close()).ok).toBe(true);
    expect(setup.client.saveDocument).toHaveBeenCalledTimes(2);
  });
  it("failed lock falls back to confirmed close without restoring plaintext", async () => {
    const setup = sessionSetup();
    await unlockTestSession(setup);
    setup.client.lockDatabase.mockResolvedValue({
      ok: false,
      error: { code: "unexpected", message: "private", retryable: false },
    });
    expect((await setup.controller.lock()).ok).toBe(false);
    expect(setup.client.closeDatabase).toHaveBeenCalledTimes(1);
    expect(setup.controller.getSnapshot().phase).toBe("closed");
    expect(setup.controller.store.getState().documentWorkspace.document).toBeNull();
  });
  it("a close response that is still locked cannot authorize another database", async () => {
    const setup = sessionSetup();
    await unlockTestSession(setup);
    setup.client.closeDatabase.mockResolvedValue(success(lockedSession));
    expect((await setup.controller.close()).ok).toBe(false);
    expect(setup.controller.getSnapshot().phase).toBe("blocked");
    expect((await setup.controller.open("other-token")).ok).toBe(false);
  });
  it("resume rejects an unconfirmed pending session and closes it", async () => {
    const { controller, client } = sessionSetup();
    client.getSessionStatus.mockResolvedValue(
      success({ ...lockedSession, phase: "pending_unlock" }),
    );
    expect((await controller.resume()).ok).toBe(false);
    expect(client.readDocument).not.toHaveBeenCalled();
    expect(client.closeDatabase).toHaveBeenCalledTimes(1);
  });
  it("resume rejects a read from a different backend session", async () => {
    const { controller, client } = sessionSetup();
    client.getSessionStatus.mockResolvedValue(success(loadedSessionDocument.session));
    client.readDocument.mockResolvedValue(
      success({
        ...loadedSessionDocument,
        session: { ...loadedSessionDocument.session, sessionId: "different-session" },
      }),
    );
    expect((await controller.resume()).ok).toBe(false);
    expect(controller.store.getState().documentWorkspace.document).toBeNull();
    expect(client.closeDatabase).toHaveBeenCalledTimes(1);
  });
  it("cancellation by a load subscriber cannot publish an unlocked session afterward", async () => {
    const { controller } = sessionSetup();
    await controller.resume();
    await controller.open("token");
    let cancelled: ReturnType<typeof controller.cancel> | undefined;
    controller.store.subscribe(() => {
      if (controller.store.getState().documentWorkspace.document !== null)
        cancelled = controller.cancel();
    });
    expect(await controller.unlock("password")).toMatchObject({
      ok: false,
      error: { code: "cancelled" },
    });
    await cancelled;
    expect(controller.getSnapshot()).toMatchObject({ phase: "closed", busy: false });
    expect(controller.store.getState().documentWorkspace.document).toBeNull();
  });
});
