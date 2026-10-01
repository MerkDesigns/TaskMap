import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { success } from "../../app/database/databaseSessionTestSupport";
import { blockTabKeyNavigation } from "../../ui/keyboard/blockTabKeyNavigation";
import {
  entrySetup,
  expectButton,
  failure,
  mountEntry,
  openEntry,
  passwordInput,
  recentDatabases,
  submitPassword,
} from "./databaseEntryTestSupport";

afterEach(cleanup);

describe("database entry with the real application session controller", () => {
  it("resumes once in StrictMode, discloses media privacy on creation, and does not mount a workspace", async () => {
    const setup = entrySetup();
    await mountEntry(setup);
    expect(setup.client.getSessionStatus).toHaveBeenCalledOnce();
    expect(screen.getByRole("heading", { name: "Recent databases" })).toBeInTheDocument();
    fireEvent.click(expectButton("New database"));
    await screen.findByLabelText("Confirm password *");
    expect(screen.getByText(/Images and GIFs are not encrypted/)).toBeInTheDocument();
    expect(screen.queryByTestId("workspace")).not.toBeInTheDocument();
    expect(setup.initializeResources).not.toHaveBeenCalled();
    expect(setup.client.readDocument).not.toHaveBeenCalled();
  });

  it("cancelling the native picker neither opens nor creates a database", async () => {
    const setup = entrySetup();
    setup.settingsClient.chooseDatabasePath.mockResolvedValue(success(null));
    await mountEntry(setup);
    fireEvent.click(expectButton("Open existing database"));
    await waitFor(() => expect(expectButton("Open existing database")).toBeEnabled());
    expect(setup.client.openDatabase).not.toHaveBeenCalled();
    expect(setup.client.createDatabase).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("creates with a one-use authorization and clears both password fields before admission", async () => {
    const setup = entrySetup();
    await mountEntry(setup);
    fireEvent.click(expectButton("New database"));
    await screen.findByLabelText("Confirm password *");
    const password = passwordInput();
    const confirm = screen.getByLabelText("Confirm password *");
    submitPassword("test-only", "test-only");
    expect(password).toHaveValue("");
    expect(confirm).toHaveValue("");
    await screen.findByTestId("workspace");
    expect(setup.client.createDatabase).toHaveBeenCalledOnce();
    expect(setup.client.createDatabase.mock.calls[0][0]).toMatchObject({
      authorizationToken: "chosen-token",
      password: "test-only",
    });
    expect(
      JSON.parse(setup.client.createDatabase.mock.calls[0][0].serializedDocument),
    ).toMatchObject({ databasePurpose: "development" });
    expect(setup.initializeResources).toHaveBeenCalledOnce();
  });

  it("rejects mismatched creation passwords locally and clears the attempted values", async () => {
    const setup = entrySetup();
    await mountEntry(setup);
    fireEvent.click(expectButton("New database"));
    await screen.findByLabelText("Confirm password *");
    submitPassword("first", "second");
    expect(screen.getByText("The passwords do not match.")).toBeInTheDocument();
    expect(passwordInput()).toHaveValue("");
    expect(screen.getByLabelText("Confirm password *")).toHaveValue("");
    expect(setup.client.createDatabase).not.toHaveBeenCalled();
  });

  it.each(["", "😀".repeat(257)])(
    "rejects an empty or oversized UTF-8 password locally",
    async (password) => {
      const setup = entrySetup();
      await mountEntry(setup);
      await openEntry();
      submitPassword(password);
      expect(passwordInput()).toHaveValue("");
      expect(setup.client.unlockDatabase).not.toHaveBeenCalled();
      expect(screen.getByText(/Enter a password of/)).toBeInTheDocument();
    },
  );

  it("keeps wrong-password failures locked, exposes no backend details, and supports retry", async () => {
    const setup = entrySetup();
    setup.client.unlockDatabase.mockResolvedValueOnce(failure("wrong_password"));
    await mountEntry(setup);
    await openEntry();
    submitPassword();
    expect(await screen.findByRole("alert")).toHaveTextContent("That password did not unlock");
    expect(document.body).not.toHaveTextContent("PRIVATE_BACKEND_DETAIL");
    expect(passwordInput()).toHaveValue("");
    expect(setup.controller.getSnapshot().phase).toBe("locked");
    expect(setup.initializeResources).not.toHaveBeenCalled();
    submitPassword();
    await screen.findByTestId("workspace");
    await act(() => setup.controller.lock());
    expect(screen.queryByTestId("workspace")).not.toBeInTheDocument();
    expect(passwordInput()).toHaveValue("");
  });

  it("returns Change database to the picker without retaining typed passwords", async () => {
    const setup = entrySetup();
    await mountEntry(setup);
    await openEntry();
    const input = passwordInput();
    fireEvent.change(input, { target: { value: "test-only" } });
    fireEvent.click(expectButton("Change database"));
    await screen.findByRole("button", { name: "Open existing database" });
    expect(input).toHaveValue("");
    expect(setup.client.closeDatabase).toHaveBeenCalledOnce();
  });

  it("rejects recent files from the other edition without attempting an open", async () => {
    const setup = entrySetup();
    setup.settingsClient.listRecentDatabases.mockResolvedValue(
      success({
        version: 1,
        edition: "stable",
        recentDatabases: [{ authorizationToken: "wrong", displayPath: "Wrong.tmapdb" }],
      }),
    );
    await mountEntry(setup);
    expect(await screen.findByText(/Recent databases could not be loaded/)).toBeInTheDocument();
    expect(screen.queryByText("Wrong.tmapdb")).not.toBeInTheDocument();
    expect(setup.client.openDatabase).not.toHaveBeenCalled();
  });

  it("opens the most recent database once at start and lists fresh authorizations after Change database", async () => {
    const setup = entrySetup();
    setup.settingsClient.listRecentDatabases.mockResolvedValue(
      recentDatabases(String.raw`\\?\D:\Work\Recent.tmapdb`),
    );
    await mountEntry(setup);
    await screen.findByLabelText("Password *");
    expect(setup.client.openDatabase).toHaveBeenCalledExactlyOnceWith({
      authorizationToken: "recent-token",
    });
    // The verbatim Windows prefix is not shown.
    expect(screen.getByText(String.raw`D:\Work\Recent.tmapdb`)).toBeInTheDocument();
    const reads = setup.settingsClient.listRecentDatabases.mock.calls.length;
    await waitFor(() => expect(expectButton("Change database")).toBeEnabled());
    fireEvent.click(expectButton("Change database"));
    const recent = await screen.findByRole("button", { name: String.raw`D:\Work\Recent.tmapdb` });
    expect(setup.settingsClient.listRecentDatabases.mock.calls.length).toBeGreaterThan(reads);
    expect(setup.client.openDatabase).toHaveBeenCalledOnce();
    fireEvent.click(recent);
    await screen.findByLabelText("Password *");
    expect(setup.client.openDatabase).toHaveBeenCalledTimes(2);
  });

  it("releases the locked database before choosing where to create a new one", async () => {
    const setup = entrySetup();
    await mountEntry(setup);
    await openEntry();
    fireEvent.click(expectButton("New database"));
    await screen.findByLabelText("Confirm password *");
    expect(setup.client.closeDatabase).toHaveBeenCalledOnce();
    expect(setup.settingsClient.chooseDatabasePath).toHaveBeenLastCalledWith("create");
    expect(setup.controller.getSnapshot().phase).toBe("closed");
  });

  it("blocks native Tab traversal, except between the two new-password fields", async () => {
    window.addEventListener("keydown", blockTabKeyNavigation, true);
    try {
      const user = userEvent.setup();
      await mountEntry(entrySetup());
      expect(expectButton("New database")).toHaveFocus();
      await user.tab();
      expect(expectButton("New database")).toHaveFocus();
      fireEvent.click(expectButton("New database"));
      await screen.findByLabelText("Confirm password *");
      await waitFor(() => expect(passwordInput()).toHaveFocus());
      await user.tab();
      expect(screen.getByLabelText("Confirm password *")).toHaveFocus();
      await user.tab();
      expect(passwordInput()).toHaveFocus();
      await user.tab({ shift: true });
      expect(screen.getByLabelText("Confirm password *")).toHaveFocus();
      // The reveal toggles are never Tab stops, and password fields never autofill.
      expect(screen.getAllByRole("button", { name: "Show password" })[0]).toHaveAttribute(
        "tabindex",
        "-1",
      );
      expect(passwordInput()).toHaveAttribute("autocomplete", "off");
    } finally {
      window.removeEventListener("keydown", blockTabKeyNavigation, true);
    }
  });
});
