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

  it("offers no tray timer: closing the window always locks into the tray", () => {
    renderActions();

    expect(screen.queryByText("Lock in the tray after")).not.toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: "Keep running in the tray" })).toBeNull();
  });
});
