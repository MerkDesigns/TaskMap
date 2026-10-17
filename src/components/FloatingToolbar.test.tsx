import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FloatingToolbar, type FloatingToolbarProps } from "./FloatingToolbar";

afterEach(cleanup);

describe("FloatingToolbar", () => {
  it("preserves every toolbar callback and toggle payload", async () => {
    const user = userEvent.setup();
    const props = toolbarProps({
      canRedo: true,
      canUndo: true,
      minimapEnabled: false,
      privacyModeEnabled: true,
    });
    render(<FloatingToolbar {...props} />);

    for (const name of ["Canvases", "Extensions", "Settings", "Undo", "Redo"]) {
      await user.click(screen.getByRole("button", { name }));
    }
    await user.click(screen.getByRole("button", { name: "Disable privacy mode" }));
    await user.click(screen.getByRole("button", { name: "Enable minimap" }));

    expect(props.onToggleCanvases).toHaveBeenCalledOnce();
    expect(props.onToggleExtensions).toHaveBeenCalledOnce();
    expect(props.onOpenSettings).toHaveBeenCalledOnce();
    expect(props.onUndo).toHaveBeenCalledOnce();
    expect(props.onRedo).toHaveBeenCalledOnce();
    expect(props.onPrivacyModeEnabledChange).toHaveBeenCalledWith(false);
    expect(props.onMinimapEnabledChange).toHaveBeenCalledWith(true);
  });

  it("retains pressed and native disabled semantics", () => {
    render(
      <FloatingToolbar
        {...toolbarProps({
          canRedo: true,
          canUndo: false,
          canvasesOpen: true,
          extensionsOpen: false,
          minimapEnabled: true,
          privacyModeEnabled: false,
        })}
      />,
    );

    expect(screen.getByRole("button", { name: "Canvases" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Extensions" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: "Enable privacy mode" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: "Disable minimap" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Redo" })).toBeEnabled();
    expect(screen.getByLabelText("Canvas toolbar")).not.toHaveAttribute("data-side-panel-open");
  });

  it("shows six plain controls, ending with the sleep mode toggle, and no collapse control", () => {
    render(<FloatingToolbar {...toolbarProps()} />);
    const workspace = screen.getByRole("group", { name: "Workspace controls" });
    const names = [...workspace.querySelectorAll("button")].map((button) =>
      button.getAttribute("aria-label"),
    );
    expect(names).toEqual([
      "Canvases",
      "Extensions",
      "Settings",
      "Enable privacy mode",
      "Enable minimap",
      "Enable sleep mode",
    ]);
    expect(screen.queryByRole("button", { name: /toolbar buttons/ })).toBeNull();
  });

  it("shows the chosen buttons in the chosen order", () => {
    render(
      <FloatingToolbar
        {...toolbarProps({ buttons: ["sleep", "settings", "placeholder-2", "canvases"] })}
      />,
    );
    const workspace = screen.getByRole("group", { name: "Workspace controls" });
    const names = [...workspace.querySelectorAll("button")].map((button) =>
      button.getAttribute("aria-label"),
    );
    expect(names).toEqual(["Enable sleep mode", "Settings", "Placeholder 2", "Canvases"]);
  });

  it("toggles the calendar island, which follows the History group", async () => {
    const user = userEvent.setup();
    const props = toolbarProps({
      calendarOpen: true,
      buttons: ["canvases", "settings", "calendar"],
    });
    render(<FloatingToolbar {...props} />);
    const calendarButton = screen.getByRole("button", { name: "Calendar" });
    expect(calendarButton).toHaveAttribute("aria-pressed", "true");
    await user.click(calendarButton);
    expect(props.onToggleCalendar).toHaveBeenCalledOnce();

    const groups = [...screen.getByLabelText("Canvas toolbar").children].map((group) =>
      group.getAttribute("aria-label"),
    );
    expect(groups).toEqual(["Workspace controls", "History controls", "Calendar"]);
  });

  it("uses two Acrylic Large groups and the cheap geometry invalidation seam", () => {
    const { container } = render(
      <>
        <FloatingToolbar {...toolbarProps({ toolbarRadius: 18 })} />
      </>,
    );

    const groups = container.querySelectorAll('[data-material="acrylic-large"]');
    expect(groups).toHaveLength(2);
    groups.forEach((group) => {
      expect(group).toHaveAttribute("data-material-strategy", "native-glass");
      expect(group).toHaveAttribute("data-material-elevation", "none");
      expect((group as HTMLElement).style.getPropertyValue("--taskmap-material-radius")).toBe(
        "18px",
      );
    });
  });
});

function toolbarProps(overrides: Partial<FloatingToolbarProps> = {}): FloatingToolbarProps {
  return {
    buttons: ["canvases", "extensions", "settings", "privacy", "minimap", "sleep"],
    calendarOpen: false,
    onToggleCalendar: vi.fn(),
    canRedo: false,
    canUndo: false,
    canvasesOpen: false,
    extensionsOpen: false,
    minimapEnabled: false,
    privacyModeEnabled: false,
    sleepModeEnabled: false,
    onSleepModeEnabledChange: vi.fn(),
    onMinimapEnabledChange: vi.fn(),
    onPrivacyModeEnabledChange: vi.fn(),
    onRedo: vi.fn(),
    onToggleExtensions: vi.fn(),
    onToggleCanvases: vi.fn(),
    onUndo: vi.fn(),
    onOpenSettings: vi.fn(),
    ...overrides,
  };
}
