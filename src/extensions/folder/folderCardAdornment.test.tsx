import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockExtensionCommands } from "../extensionCommandsTestSupport";
import { folderCardAdornment } from "./folderCardAdornment";
import { normalizeFolderPath } from "./folderDefinition";

afterEach(cleanup);

function renderButton(path: string, openResult: "opened" | "missing" | "failed" = "opened") {
  const commands = { ...mockExtensionCommands(), openFolder: vi.fn(async () => openResult) };
  const Leading = folderCardAdornment.Leading!;
  render(
    <Leading
      context={{ elementId: "card", accent: "#fff", extensions: { folder: { path } } }}
      commands={commands}
    />,
  );
  return commands;
}

describe("folder button", () => {
  it("asks for a folder while the card has none", async () => {
    const commands = renderButton("");
    await userEvent.click(screen.getByRole("button", { name: "Choose a folder" }));
    expect(commands.openFolderEditor).toHaveBeenCalledWith("card");
    expect(commands.openFolder).not.toHaveBeenCalled();
  });

  it("opens the card's folder", async () => {
    const commands = renderButton(String.raw`C:\Projects`);
    await userEvent.click(screen.getByRole("button", { name: String.raw`Open C:\Projects` }));
    expect(commands.openFolder).toHaveBeenCalledWith("card");
  });

  it("dims a folder that was not found", async () => {
    renderButton(String.raw`D:\Gone`, "missing");
    const button = screen.getByRole("button", { name: String.raw`Open D:\Gone` });
    await act(async () => userEvent.click(button));
    expect(button).toHaveAttribute("data-state", "missing");
    expect(button).toHaveAccessibleName(String.raw`Folder not found: D:\Gone`);
  });
});

describe("normalizeFolderPath", () => {
  it("strips whitespace and the quotes of Explorer's Copy as path", () => {
    expect(normalizeFolderPath(String.raw`  "C:\My Projects"  `)).toBe(String.raw`C:\My Projects`);
    expect(normalizeFolderPath(String.raw` C:\Plain `)).toBe(String.raw`C:\Plain`);
    expect(normalizeFolderPath(`"`)).toBe(`"`);
  });
});
