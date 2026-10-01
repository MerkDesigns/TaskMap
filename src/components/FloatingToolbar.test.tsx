import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MaterialSurfaceRegistrationProvider } from "../ui/materials/MaterialSurfaceRegistration";
import { createMaterialSurfaceRegistry } from "../ui/materials/materialSurfaceRegistry";
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

  it("uses two Acrylic Large groups and the cheap geometry invalidation seam", () => {
    const notifySurfaceGeometryChanged = vi.fn();
    const registry = createMaterialSurfaceRegistry(null);
    const { container } = render(
      <MaterialSurfaceRegistrationProvider value={{ registry, notifySurfaceGeometryChanged }}>
        <FloatingToolbar {...toolbarProps({ toolbarRadius: 18 })} />
      </MaterialSurfaceRegistrationProvider>,
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
    expect(registry.getSnapshot().surfaces).toEqual([]);
    expect(notifySurfaceGeometryChanged).not.toHaveBeenCalled();
  });
});

function toolbarProps(overrides: Partial<FloatingToolbarProps> = {}): FloatingToolbarProps {
  return {
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
