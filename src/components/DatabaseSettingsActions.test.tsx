import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DatabaseSettingsActions,
  type DatabaseSettingsActionsProps,
} from "./DatabaseSettingsActions";

afterEach(cleanup);

const renderActions = (overrides: Partial<DatabaseSettingsActionsProps> = {}) => {
  const props: DatabaseSettingsActionsProps = {
    lock: vi.fn(async () => true),
    close: vi.fn(async () => true),
    quit: vi.fn(async () => true),
    closeToTray: true,
    onCloseToTrayChange: vi.fn(),
    trayLockMinutes: 0,
    onTrayLockMinutesChange: vi.fn(),
    ...overrides,
  };
  render(<DatabaseSettingsActions {...props} />);
  return props;
};

describe("DatabaseSettingsActions", () => {
  it("quits TaskMap through the session owner", () => {
    const props = renderActions();

    fireEvent.click(screen.getByRole("button", { name: "Quit TaskMap" }));

    expect(props.quit).toHaveBeenCalled();
  });

  it("chooses how long the database may stay unlocked in the tray", () => {
    const props = renderActions();

    fireEvent.click(screen.getByRole("button", { name: "1 hour" }));

    expect(props.onTrayLockMinutesChange).toHaveBeenCalledWith(60);
  });

  it("hides the tray timer when closing quits instead", () => {
    renderActions({ closeToTray: false });

    expect(
      screen.getByText("Closing the window locks the database and quits TaskMap."),
    ).toBeVisible();
    expect(screen.queryByText("Lock in the tray after")).not.toBeInTheDocument();
  });
});
