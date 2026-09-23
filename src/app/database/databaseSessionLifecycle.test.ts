// @vitest-environment node
import { describe, expect, it } from "vitest";
import { renameCommand } from "../workspace/workspaceTestSupport";
import {
  loadedSessionDocument,
  sessionSetup,
  success,
  unlockTestSession,
} from "./databaseSessionTestSupport";

describe("application database session lifecycle", () => {
  it("does not access IPC on construction, and requires startup reconciliation", async () => {
    const { controller, client } = sessionSetup();
    expect(controller.getSnapshot()).toMatchObject({ phase: "unknown", busy: false });
    expect(client.getSessionStatus).not.toHaveBeenCalled();
    expect((await controller.create("token", "password")).ok).toBe(false);
    expect((await controller.resume()).ok).toBe(true);
    expect(controller.getSnapshot().phase).toBe("closed");
  });
  it("creates a fresh canonical document with a path token, without retaining the password", async () => {
    const { controller, client } = sessionSetup();
    await controller.resume();
    expect((await controller.create("authorized-token", "not-for-state")).ok).toBe(true);
    const request = client.createDatabase.mock.calls[0][0];
    expect(request.authorizationToken).toBe("authorized-token");
    expect(JSON.parse(request.serializedDocument)).toMatchObject({
      schemaVersion: 1,
      databasePurpose: "development",
    });
    expect(JSON.stringify(controller.getSnapshot())).not.toContain("not-for-state");
    expect(JSON.stringify(controller.store.getState())).not.toContain("not-for-state");
    expect(client.saveDocument).not.toHaveBeenCalled();
  });
  it("opens locked and unlocks into the existing workspace", async () => {
    const setup = sessionSetup();
    await unlockTestSession(setup);
    expect(setup.controller.getSnapshot()).toMatchObject({ phase: "unlocked", busy: false });
    expect(setup.controller.store.getState().documentWorkspace.backendRevision).toBe(4);
    expect(setup.client.openDatabase).toHaveBeenCalledWith({
      authorizationToken: "test-path-token",
    });
  });
  it("resumes a keeper session without password or rewriting the loaded document", async () => {
    const { controller, client } = sessionSetup();
    client.getSessionStatus.mockResolvedValue(success(loadedSessionDocument.session));
    expect((await controller.resume()).ok).toBe(true);
    expect(client.readDocument).toHaveBeenCalledTimes(1);
    expect(client.unlockDatabase).not.toHaveBeenCalled();
    expect(client.saveDocument).not.toHaveBeenCalled();
  });
  it("allows wrong-password retry without leaking transport details", async () => {
    const { controller, client } = sessionSetup();
    await controller.resume();
    await controller.open("token");
    client.unlockDatabase.mockResolvedValueOnce({
      ok: false,
      error: {
        code: "wrong_password",
        message: "private transport detail",
        retryable: true,
      },
    });
    const result = await controller.unlock("wrong");
    expect(result).toMatchObject({ ok: false, error: { code: "wrong_password" } });
    expect(JSON.stringify(result)).not.toContain("private");
    expect(controller.getSnapshot().phase).toBe("locked");
    expect((await controller.unlock("correct")).ok).toBe(true);
  });
  it.each(["lock", "close", "quit"] as const)(
    "flushes before %s, clears frontend data and calls the correct backend operation",
    async (operation) => {
      const setup = sessionSetup();
      await unlockTestSession(setup);
      const { controller, client, purge } = setup;
      controller.store.workspace.dispatchCommand(renameCommand("Changed"));
      const result = await controller[operation]();
      expect(result.ok).toBe(true);
      expect(client.saveDocument).toHaveBeenCalledTimes(1);
      const action =
        operation === "lock"
          ? client.lockDatabase
          : operation === "close"
            ? client.closeDatabase
            : client.quitApplication;
      expect(client.saveDocument.mock.invocationCallOrder[0]).toBeLessThan(
        action.mock.invocationCallOrder[0],
      );
      expect(controller.store.getState().documentWorkspace.document).toBeNull();
      expect(controller.store.getState().documentWorkspace.history.past).toHaveLength(0);
      expect(purge).toHaveBeenCalled();
    },
  );
  it("window close only flushes, preserving the unlocked keeper session", async () => {
    const setup = sessionSetup();
    await unlockTestSession(setup);
    setup.controller.store.workspace.dispatchCommand(renameCommand("Changed"));
    expect((await setup.controller.prepareWindowClose()).ok).toBe(true);
    expect(setup.controller.getSnapshot().phase).toBe("unlocked");
    expect(setup.client.closeDatabase).not.toHaveBeenCalled();
    expect(setup.client.lockDatabase).not.toHaveBeenCalled();
  });
  it.each(["save_failure", "revision_conflict"] as const)(
    "does not close or discard edits after %s",
    async (code) => {
      const setup = sessionSetup();
      await unlockTestSession(setup);
      setup.client.saveDocument.mockResolvedValue({
        ok: false,
        error: { code, message: "unsafe", retryable: true },
      });
      setup.controller.store.workspace.dispatchCommand(renameCommand("Unsaved"));
      expect((await setup.controller.close()).ok).toBe(false);
      expect(setup.client.closeDatabase).not.toHaveBeenCalled();
      expect(setup.controller.getSnapshot()).toMatchObject({ phase: "unlocked", busy: false });
      expect(setup.controller.store.getState().documentWorkspace.document).not.toBeNull();
    },
  );
  it("failed admission closes the confirmed candidate without publishing plaintext", async () => {
    const { controller, client, purge } = sessionSetup();
    await controller.resume();
    await controller.open("token");
    client.unlockDatabase.mockResolvedValue(
      success({ ...loadedSessionDocument, serializedDocument: "invalid" }),
    );
    expect((await controller.unlock("password")).ok).toBe(false);
    expect(client.closeDatabase).toHaveBeenCalledTimes(1);
    expect(purge).toHaveBeenCalled();
    expect(controller.store.getState().documentWorkspace.document).toBeNull();
  });

  it.each(["prepareWindowClose", "lock", "close"] as const)(
    "a repeated %s retries a recoverable failed save before proceeding",
    async (operation) => {
      const setup = sessionSetup();
      await unlockTestSession(setup);
      setup.controller.store.workspace.dispatchCommand(renameCommand("Keep this edit"));
      setup.client.saveDocument.mockResolvedValueOnce({
        ok: false,
        error: { code: "save_failure", message: "test failure", retryable: true },
      });
      expect((await setup.controller[operation]()).ok).toBe(false);
      expect(setup.controller.getSnapshot().phase).toBe("unlocked");
      expect((await setup.controller[operation]()).ok).toBe(true);
      expect(setup.client.saveDocument).toHaveBeenCalledTimes(2);
      await setup.controller.dispose();
    },
  );

  it("repeated close never retries a revision conflict as an overwrite", async () => {
    const setup = sessionSetup();
    await unlockTestSession(setup);
    setup.controller.store.workspace.dispatchCommand(renameCommand("Conflicting edit"));
    setup.client.saveDocument.mockResolvedValueOnce({
      ok: false,
      error: { code: "revision_conflict", message: "test conflict", retryable: false },
    });
    expect((await setup.controller.prepareWindowClose()).ok).toBe(false);
    expect((await setup.controller.prepareWindowClose()).ok).toBe(false);
    expect(setup.client.saveDocument).toHaveBeenCalledTimes(1);
    expect(setup.controller.store.getState().documentWorkspace.document).not.toBeNull();
    await setup.controller.dispose();
  });
});
