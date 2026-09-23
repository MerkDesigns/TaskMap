import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { loadedSessionDocument, success } from "../../app/database/databaseSessionTestSupport";
import type { LoadedDocument } from "../../platform/database/databaseTypes";
import type { PlatformResult } from "../../platform/platformErrors";
import type { AuthorizedDatabasePath } from "../../platform/settings/settingsTypes";
import {
  deferred,
  entrySetup,
  expectButton,
  failure,
  mountEntry,
  openEntry,
  passwordInput,
  submitPassword,
} from "./databaseEntryTestSupport";

afterEach(cleanup);

describe("database entry cancellation and resource admission", () => {
  it("requires recovery acknowledgement before mounting and does not write on acknowledgement", async () => {
    const setup = entrySetup();
    setup.client.unlockDatabase.mockResolvedValue(
      success({ ...loadedSessionDocument, recoveredFromRevision: 2 }),
    );
    await mountEntry(setup);
    await openEntry();
    submitPassword();
    await screen.findByRole("button", { name: "Review recovered workspace" });
    expect(screen.getByRole("alert")).toHaveTextContent("saved revision 2");
    expect(screen.queryByTestId("workspace")).not.toBeInTheDocument();
    fireEvent.click(expectButton("Review recovered workspace"));
    await screen.findByTestId("workspace");
    expect(setup.client.saveDocument).not.toHaveBeenCalled();
    await act(() => setup.controller.lock());
    submitPassword();
    await screen.findByRole("button", { name: "Review recovered workspace" });
    expect(screen.queryByTestId("workspace")).not.toBeInTheDocument();
  });

  it("revokes a pending unlock immediately and never mounts its late result", async () => {
    const setup = entrySetup();
    const pending = deferred<PlatformResult<LoadedDocument>>();
    setup.client.unlockDatabase.mockReturnValue(pending.promise);
    await mountEntry(setup);
    await openEntry();
    submitPassword();
    await waitFor(() => expect(setup.client.unlockDatabase).toHaveBeenCalledOnce());
    fireEvent.click(expectButton("Cancel opening"));
    expect(screen.queryByLabelText("Password *")).not.toBeInTheDocument();
    expect(setup.controller.getSnapshot().phase).toBe("blocked");
    await act(async () => pending.resolve(success(loadedSessionDocument)));
    await screen.findByRole("button", { name: "Open database" });
    expect(screen.queryByTestId("workspace")).not.toBeInTheDocument();
    expect(setup.initializeResources).not.toHaveBeenCalled();
  });
  it("coalesces picker clicks and ignores a result after unmount", async () => {
    const setup = entrySetup();
    const pending = deferred<PlatformResult<AuthorizedDatabasePath | null>>();
    setup.settingsClient.chooseDatabasePath.mockReturnValue(pending.promise);
    const view = await mountEntry(setup);
    fireEvent.click(expectButton("Open database"));
    fireEvent.click(expectButton("Open database"));
    expect(setup.settingsClient.chooseDatabasePath).toHaveBeenCalledOnce();
    view.unmount();
    await act(async () =>
      pending.resolve(success({ authorizationToken: "late", displayPath: "Late.tmapdb" })),
    );
    expect(setup.client.openDatabase).not.toHaveBeenCalled();
  });

  it("does not open a pending picker result after the session has been revoked", async () => {
    const setup = entrySetup();
    const pending = deferred<PlatformResult<AuthorizedDatabasePath | null>>();
    setup.settingsClient.chooseDatabasePath.mockReturnValue(pending.promise);
    await mountEntry(setup);
    fireEvent.click(expectButton("Open database"));
    await act(() => setup.controller.cancel());
    await act(async () =>
      pending.resolve(success({ authorizationToken: "late", displayPath: "Late.tmapdb" })),
    );
    expect(setup.client.openDatabase).not.toHaveBeenCalled();
    expect(screen.queryByText("Late.tmapdb")).not.toBeInTheDocument();
  });

  it("clears the password before a pending unlock and prevents duplicate submission", async () => {
    const setup = entrySetup();
    const pending = deferred<PlatformResult<LoadedDocument>>();
    setup.client.unlockDatabase.mockReturnValue(pending.promise);
    await mountEntry(setup);
    await openEntry();
    const input = passwordInput();
    submitPassword();
    expect(input).toHaveValue("");
    expect(input).toBeDisabled();
    fireEvent.submit(input.closest("form")!);
    await waitFor(() => expect(setup.client.unlockDatabase).toHaveBeenCalledOnce());
    expect(setup.initializeResources).not.toHaveBeenCalled();
    await act(async () => pending.resolve(success(loadedSessionDocument)));
    await screen.findByTestId("workspace");
    expect(setup.client.unlockDatabase).toHaveBeenCalledOnce();
  });

  it("keeps the canvas unmounted until resources finish and ignores late cancelled completion", async () => {
    const setup = entrySetup();
    const pending = deferred<PlatformResult<void>>();
    setup.initializeResources.mockReturnValue(pending.promise);
    await mountEntry(setup);
    await openEntry();
    submitPassword();
    await screen.findByText("Loading preferences and remembered views…");
    await waitFor(() => expect(setup.initializeResources).toHaveBeenCalledOnce());
    expect(screen.queryByTestId("workspace")).not.toBeInTheDocument();
    fireEvent.click(expectButton("Cancel opening"));
    await screen.findByRole("button", { name: "Open database" });
    await act(async () => pending.resolve(success(undefined)));
    expect(screen.queryByTestId("workspace")).not.toBeInTheDocument();
    expect(setup.controller.getSnapshot().phase).toBe("closed");
    expect(setup.controller.store.getState().documentWorkspace.document).toBeNull();
  });

  it("shows resource failures, retries only on request, and admits the same session after success", async () => {
    const setup = entrySetup();
    setup.initializeResources.mockResolvedValueOnce(failure());
    await mountEntry(setup);
    await openEntry();
    submitPassword();
    await screen.findByRole("button", { name: "Retry loading" });
    expect(setup.initializeResources).toHaveBeenCalledOnce();
    expect(screen.queryByTestId("workspace")).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("PRIVATE_BACKEND_DETAIL");
    fireEvent.click(expectButton("Retry loading"));
    await screen.findByTestId("workspace");
    expect(setup.initializeResources).toHaveBeenCalledTimes(2);
    expect(setup.client.unlockDatabase).toHaveBeenCalledOnce();
  });

  it("does not reread resources for an ordinary save, but reloads them after lock/unlock", async () => {
    const setup = entrySetup();
    await mountEntry(setup);
    await openEntry();
    submitPassword();
    await screen.findByTestId("workspace");
    await act(() => setup.controller.prepareWindowClose());
    expect(setup.initializeResources).toHaveBeenCalledOnce();
    expect(screen.getByTestId("workspace")).toBeInTheDocument();
    await act(() => setup.controller.lock());
    expect(screen.queryByTestId("workspace")).not.toBeInTheDocument();
    submitPassword();
    await screen.findByTestId("workspace");
    expect(setup.initializeResources).toHaveBeenCalledTimes(2);
  });

  it("offers explicit cleanup when native cleanup fails without displaying the workspace", async () => {
    const setup = entrySetup();
    setup.client.openDatabase.mockResolvedValueOnce(failure());
    setup.client.closeDatabase.mockResolvedValueOnce(failure());
    await mountEntry(setup);
    fireEvent.click(expectButton("Open database"));
    await screen.findByRole("button", { name: "Retry session cleanup" });
    expect(screen.queryByTestId("workspace")).not.toBeInTheDocument();
    fireEvent.click(expectButton("Retry session cleanup"));
    await screen.findByRole("button", { name: "Open database" });
    expect(setup.controller.getSnapshot().phase).toBe("closed");
  });
});
