import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
      toolbarButtonsVisible: true,
    });
    render(<FloatingToolbar {...props} />);

    for (const name of ["Canvases", "Extensions", "Settings", "Undo", "Redo"]) {
      await user.click(screen.getByRole("button", { name }));
    }
    await user.click(screen.getByRole("button", { name: "Hide toolbar buttons" }));
    await user.click(screen.getByRole("button", { name: "Disable privacy mode" }));
    await user.click(screen.getByRole("button", { name: "Enable minimap" }));

    expect(props.onToggleCanvases).toHaveBeenCalledOnce();
    expect(props.onToggleExtensions).toHaveBeenCalledOnce();
    expect(props.onOpenSettings).toHaveBeenCalledOnce();
    expect(props.onUndo).toHaveBeenCalledOnce();
    expect(props.onRedo).toHaveBeenCalledOnce();
    expect(props.onToolbarButtonsVisibleChange).toHaveBeenCalledWith(false);
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

  it("keeps collapsed controls aria-hidden and outside the tab order", () => {
    const { rerender } = render(
      <FloatingToolbar {...toolbarProps({ toolbarButtonsVisible: false })} />,
    );
    const expand = screen.getByRole("button", { name: "Show toolbar buttons" });
    const privacy = screen.getByTitle("Enable privacy mode");
    const minimap = screen.getByTitle("Enable minimap");
    const optionalControls = privacy.parentElement;

    expect(expand).toHaveAttribute("aria-expanded", "false");
    expect(optionalControls).toHaveAttribute("aria-hidden", "true");
    expect(privacy).toHaveAttribute("tabindex", "-1");
    expect(minimap).toHaveAttribute("tabindex", "-1");

    rerender(<FloatingToolbar {...toolbarProps({ toolbarButtonsVisible: true })} />);

    expect(screen.getByRole("button", { name: "Hide toolbar buttons" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("button", { name: "Enable privacy mode" })).toHaveAttribute(
      "tabindex",
      "0",
    );
    expect(screen.getByRole("button", { name: "Enable minimap" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByTitle("Enable privacy mode").parentElement).toHaveAttribute(
      "aria-hidden",
      "false",
    );
  });

  it("uses two Acrylic Large groups and the cheap geometry invalidation seam", () => {
    const notifySurfaceGeometryChanged = vi.fn();
    const registry = createMaterialSurfaceRegistry(null);
    const { container } = render(
      <MaterialSurfaceRegistrationProvider value={{ registry, notifySurfaceGeometryChanged }}>
        <FloatingToolbar {...toolbarProps()} />
      </MaterialSurfaceRegistrationProvider>,
    );

    const groups = container.querySelectorAll('[data-material="acrylic-large"]');
    expect(groups).toHaveLength(2);
    groups.forEach((group) => {
      expect(group).toHaveAttribute("data-material-strategy", "native-glass");
      expect(group).toHaveAttribute("data-material-elevation", "none");
      expect((group as HTMLElement).style.getPropertyValue("--taskmap-material-radius")).toBe(
        "23px",
      );
    });
    expect(registry.getSnapshot().surfaces).toEqual([]);
    const invalidationsAfterMount = notifySurfaceGeometryChanged.mock.calls.length;
    const privacy = screen.getByTitle("Enable privacy mode");
    const optionalControls = privacy.parentElement as HTMLElement;

    dispatchTransitionEnd(optionalControls, "opacity");
    dispatchTransitionEnd(privacy, "transform");
    dispatchTransitionEnd(privacy, "max-width");
    expect(notifySurfaceGeometryChanged).toHaveBeenCalledTimes(invalidationsAfterMount);

    dispatchTransitionEnd(optionalControls, "max-width");
    expect(notifySurfaceGeometryChanged).toHaveBeenCalledTimes(invalidationsAfterMount + 1);
  });
});

function dispatchTransitionEnd(element: HTMLElement, propertyName: string): void {
  const event = new Event("transitionend", { bubbles: true });
  Object.defineProperty(event, "propertyName", { value: propertyName });
  fireEvent(element, event);
}

function toolbarProps(overrides: Partial<FloatingToolbarProps> = {}): FloatingToolbarProps {
  return {
    canRedo: false,
    canUndo: false,
    canvasesOpen: false,
    extensionsOpen: false,
    minimapEnabled: false,
    privacyModeEnabled: false,
    toolbarButtonsVisible: true,
    onMinimapEnabledChange: vi.fn(),
    onPrivacyModeEnabledChange: vi.fn(),
    onRedo: vi.fn(),
    onToolbarButtonsVisibleChange: vi.fn(),
    onToggleExtensions: vi.fn(),
    onToggleCanvases: vi.fn(),
    onUndo: vi.fn(),
    onOpenSettings: vi.fn(),
    ...overrides,
  };
}
