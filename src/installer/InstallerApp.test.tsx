import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  InstallError,
  type InstallerClient,
  type InstallerDetails,
  type InstallStage,
} from "../platform/installer/installerClient";
import { InstallerApp } from "./InstallerApp";

afterEach(cleanup);

const details: InstallerDetails = {
  productName: "TaskMap",
  version: "0.3.4",
  defaultLocation: String.raw`C:\Users\me\AppData\Local\TaskMap`,
  existing: null,
  legacyInstalled: false,
  simulated: false,
};

function fakeClient(overrides: Partial<InstallerClient> = {}) {
  let finishInstall: (() => void) | null = null;
  let reportStage: ((stage: InstallStage) => void) | null = null;
  const client: InstallerClient = {
    details: vi.fn(async () => details),
    chooseLocation: vi.fn(async () => String.raw`D:\Apps\TaskMap`),
    install: vi.fn(
      (_request, onStage) =>
        new Promise<void>((resolve) => {
          reportStage = onStage;
          finishInstall = resolve;
        }),
    ),
    launch: vi.fn(async () => undefined),
    minimize: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
    ...overrides,
  };
  return {
    client,
    stage: (stage: InstallStage) => act(() => reportStage?.(stage)),
    finish: () => act(async () => finishInstall?.()),
  };
}

describe("InstallerApp", () => {
  it("installs with the chosen options and launches TaskMap on finish", async () => {
    const { client, stage, finish } = fakeClient();
    render(<InstallerApp client={client} />);

    fireEvent.click(await screen.findByRole("button", { name: "Options" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Create a desktop shortcut" }));
    fireEvent.click(screen.getByRole("button", { name: "Browse…" }));
    expect(await screen.findByText(String.raw`D:\Apps\TaskMap`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Install" }));

    expect(client.install).toHaveBeenCalledWith(
      {
        location: String.raw`D:\Apps\TaskMap`,
        startMenuShortcut: true,
        desktopShortcut: false,
        update: false,
      },
      expect.any(Function),
    );
    expect(screen.getByRole("button", { name: "Close" })).toBeDisabled();
    stage("installing");
    expect(screen.getByText("Installing files").closest("li")).toHaveAttribute(
      "data-state",
      "active",
    );

    await finish();
    fireEvent.click(screen.getByRole("button", { name: "Finish" }));
    await vi.waitFor(() => expect(client.close).toHaveBeenCalled());
    expect(client.launch).toHaveBeenCalled();
  });

  it("explains a failed install and lets the user try again", async () => {
    const { client } = fakeClient({
      install: vi.fn(async () => {
        throw new InstallError("failed");
      }),
    });
    render(<InstallerApp client={client} />);

    fireEvent.click(await screen.findByRole("button", { name: "Install" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("close it and try again");

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByRole("button", { name: "Install" })).toBeInTheDocument();
  });

  it("offers an update when an older version is installed", async () => {
    const existing = { version: "0.3.2", location: String.raw`D:\TaskMap`, executable: "" };
    const { client } = fakeClient({ details: vi.fn(async () => ({ ...details, existing })) });
    render(<InstallerApp client={client} />);

    expect(await screen.findByRole("heading", { name: "Update TaskMap" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Update" }));
    expect(client.install).toHaveBeenCalledWith(
      expect.objectContaining({ location: existing.location, update: true }),
      expect.any(Function),
    );
  });
});
