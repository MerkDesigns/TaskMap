import { invoke } from "@tauri-apps/api/core";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommandRunnerSettingsModal, ExtensionConflictModal } from "./CommandRunnerModals";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
afterEach(cleanup);

describe("Command Runner settings", () => {
  beforeEach(() => vi.mocked(invoke).mockReset());

  it("adds, validates, configures, and saves a command", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    vi.mocked(invoke).mockResolvedValue("C:\\workspace");
    render(
      <CommandRunnerSettingsModal
        cardText="Build"
        commands={[]}
        onCancel={vi.fn()}
        onSave={onSave}
      />,
    );

    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "false");
    expect(document.querySelector(".json-editor-scrollbar")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add command" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("Commands cannot be blank.")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Command 1"), "npm test");
    await user.click(screen.getByRole("button", { name: "Background" }));
    expect(screen.getByRole("button", { name: "Background" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.click(screen.getByTitle("Choose folder"));
    expect(invoke).toHaveBeenCalledWith("pick_command_working_directory");
    expect(screen.getByLabelText("Working directory 1")).toHaveValue("C:\\workspace");
    await user.click(screen.getByRole("button", { name: "Run as administrator 1" }));
    expect(screen.getByText("Run this command as administrator?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Enable Admin" }));
    expect(screen.getByRole("button", { name: "Run as administrator 1" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalledWith([
      {
        command: "npm test",
        workingDirectory: "C:\\workspace",
        runMode: "background",
        runAsAdmin: true,
      },
    ]);
  });

  it("reorders and removes rows while Cancel leaves data unchanged", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onSave = vi.fn();
    render(
      <CommandRunnerSettingsModal
        cardText="Build"
        commands={[
          { command: "first", runMode: "terminal" },
          { command: "second", runMode: "background" },
        ]}
        onCancel={onCancel}
        onSave={onSave}
      />,
    );

    await user.click(screen.getAllByTitle("Move down")[0]);
    await user.click(screen.getAllByTitle("Remove command")[1]);
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalledWith([{ command: "second", runMode: "background" }]);

    await waitFor(() => expect(onCancel).toHaveBeenCalledOnce());
  });

  it("permits saving an empty command list", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <CommandRunnerSettingsModal
        cardText="Build"
        commands={[]}
        onCancel={vi.fn()}
        onSave={onSave}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalledWith([]);
  });
});

describe("extension conflict confirmation", () => {
  it("shows selection counts and the saved-command warning", () => {
    render(
      <ExtensionConflictModal
        requestedLabel="Checkbox"
        existingLabels={["Command Runner"]}
        affectedCount={2}
        targetCount={3}
        removesSavedCommands
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByText(/2 of 3 selected cards/)).toBeInTheDocument();
    expect(screen.getByText(/Saved Command Runner commands/)).toBeInTheDocument();
  });
});
