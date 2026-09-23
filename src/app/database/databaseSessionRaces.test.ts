// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { LoadedDocument, SavedDocument } from "../../platform/database/databaseTypes";
import type { PlatformResult } from "../../platform/platformErrors";
import { createDeferred, renameCommand, savedDocument } from "../workspace/workspaceTestSupport";
import {
  loadedSessionDocument,
  sessionSetup,
  success,
  unlockTestSession,
} from "./databaseSessionTestSupport";

describe("database session transition safety", () => {
  it("rejects double actions and blocks commands/undo/redo throughout a pending save", async () => {
    const setup = sessionSetup();
    await unlockTestSession(setup);
    const { controller, client } = setup;
    controller.store.workspace.dispatchCommand(renameCommand("Before"));
    const pending = createDeferred<PlatformResult<SavedDocument>>();
    client.saveDocument.mockReturnValue(pending.promise);
    const closing = controller.close();
    expect((await controller.lock()).ok).toBe(false);
    for (const result of [
      controller.store.workspace.dispatchCommand(renameCommand("During")),
      controller.store.workspace.undo(),
      controller.store.workspace.redo(),
    ]) {
      expect(result).toMatchObject({ ok: false, code: "workspace-not-editable" });
    }
    pending.resolve(savedDocument(5));
    expect((await closing).ok).toBe(true);
    expect(client.lockDatabase).not.toHaveBeenCalled();
  });
  it("cancel revokes access immediately, drains late unlock, and never admits its result", async () => {
    const { controller, client, purge } = sessionSetup();
    await controller.resume();
    await controller.open("token");
    const pending = createDeferred<PlatformResult<LoadedDocument>>();
    client.unlockDatabase.mockReturnValue(pending.promise);
    const unlocking = controller.unlock("password");
    await Promise.resolve();
    const cancelled = controller.cancel();
    expect(controller.getSnapshot()).toMatchObject({ phase: "blocked", busy: true });
    expect(controller.store.getState().documentWorkspace.document).toBeNull();
    expect(purge).toHaveBeenCalled();
    expect((await controller.open("other-token")).ok).toBe(false);
    expect(client.closeDatabase).not.toHaveBeenCalled();
    pending.resolve(success(loadedSessionDocument));
    expect(await unlocking).toMatchObject({ ok: false, error: { code: "cancelled" } });
    expect((await cancelled).ok).toBe(true);
    expect(client.closeDatabase).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot()).toMatchObject({ phase: "closed", busy: false });
    expect(controller.store.getState().documentWorkspace.document).toBeNull();
  });
  it("keeps the app blocked if backend cleanup cannot be confirmed", async () => {
    const setup = sessionSetup();
    await unlockTestSession(setup);
    setup.client.closeDatabase.mockRejectedValue(new Error("private exception"));
    expect((await setup.controller.cancel()).ok).toBe(false);
    expect(setup.controller.getSnapshot().phase).toBe("blocked");
    expect(setup.controller.store.getState().documentWorkspace.document).toBeNull();
    expect((await setup.controller.create("token", "password")).ok).toBe(false);
  });
  it("clears local state and attempts backend cleanup even if resource revocation throws", async () => {
    const setup = sessionSetup();
    await unlockTestSession(setup);
    setup.purge.mockImplementation(() => {
      throw new Error("private cache detail");
    });
    expect((await setup.controller.lock()).ok).toBe(false);
    expect(setup.client.closeDatabase).toHaveBeenCalled();
    expect(setup.controller.getSnapshot().phase).toBe("blocked");
    expect(setup.controller.store.getState().documentWorkspace.document).toBeNull();
  });
  it("save reports backend session loss: purge rather than leave a writable stale document", async () => {
    const setup = sessionSetup();
    await unlockTestSession(setup);
    setup.client.saveDocument.mockResolvedValue({
      ok: false,
      error: {
        code: "session_locked",
        message: "unsafe",
        retryable: false,
      },
    });
    setup.controller.store.workspace.dispatchCommand(renameCommand("Changed"));
    expect((await setup.controller.prepareWindowClose()).ok).toBe(false);
    expect(setup.controller.store.getState().documentWorkspace.document).toBeNull();
    expect(setup.client.closeDatabase).toHaveBeenCalled();
  });
  it("disposal during unlock rejects late work and leaves no writable workspace", async () => {
    const { controller, client } = sessionSetup();
    await controller.resume();
    await controller.open("token");
    const pending = createDeferred<PlatformResult<LoadedDocument>>();
    client.unlockDatabase.mockReturnValue(pending.promise);
    const unlocking = controller.unlock("password");
    await Promise.resolve();
    const disposing = controller.dispose();
    pending.resolve(success(loadedSessionDocument));
    await unlocking;
    await disposing;
    expect((await controller.resume()).ok).toBe(false);
    expect(controller.store.getState().documentWorkspace.document).toBeNull();
  });
  it("observer exceptions cannot skip cleanup", async () => {
    const setup = sessionSetup();
    await unlockTestSession(setup);
    setup.controller.subscribe(() => {
      throw new Error("observer");
    });
    expect((await setup.controller.close()).ok).toBe(true);
    expect(setup.client.closeDatabase).toHaveBeenCalledTimes(1);
  });
});
