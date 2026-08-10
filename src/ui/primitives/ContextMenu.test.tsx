import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MaterialSurfaceRegistrationProvider } from "../materials/MaterialSurfaceRegistration";
import { createMaterialSurfaceRegistry } from "../materials/materialSurfaceRegistry";
import { MOTION_DURATION_MS } from "../motion/motionTokens";
import { ReducedMotionProvider } from "../motion/reducedMotionPreference";
import { ContextMenu } from "./ContextMenu";
import { ContextMenuDivider, ContextMenuItem } from "./ContextMenuParts";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("ContextMenu", () => {
  it("opens on the opaque surface with native menu-item semantics", () => {
    const { container } = render(<MenuHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    const menu = screen.getByRole("menu", { name: "Example menu" });
    expect(menu).toHaveAttribute("data-material", "opaque");
    expect(menu).toHaveAttribute("data-material-strategy", "opaque");
    expect(menu).not.toHaveAttribute("data-material-surface-id");
    expect(menu).toHaveStyle("--taskmap-material-radius: 8px");
    expect(menu).toHaveStyle({ left: "120px", top: "80px" });
    expect(screen.getByRole("menuitem", { name: "Edit" })).toHaveFocus();
    expect(screen.getByRole("menuitem", { name: "Edit" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("menuitem", { name: "Disabled" })).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("menuitem", { name: "Remove" })).toHaveAttribute("data-tone", "danger");
    expect(container.querySelectorAll('[role="separator"]')).toHaveLength(1);
  });

  it("closes on outside pointer and remains mounted for the exit motion", () => {
    vi.useFakeTimers();
    render(<MenuHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    fireEvent.pointerDown(document.body);
    expect(screen.getByRole("menu", { name: "Example menu" })).toHaveAttribute(
      "data-motion-state",
      "closing",
    );
    act(() => vi.advanceTimersByTime(MOTION_DURATION_MS.menuExit));
    expect(screen.queryByRole("menu", { name: "Example menu" })).not.toBeInTheDocument();
  });

  it("closes on Escape and restores focus to the anchor", () => {
    vi.useFakeTimers();
    render(<MenuHarness />);
    const trigger = screen.getByRole("button", { name: "Open menu" });
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(trigger).toHaveFocus();
    expect(screen.getByRole("menu", { name: "Example menu" })).toHaveAttribute(
      "data-motion-state",
      "closing",
    );
  });

  it("provides wrapping roving focus with arrows and Home/End while skipping disabled items", () => {
    render(<MenuHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    const edit = screen.getByRole("menuitem", { name: "Edit" });
    const disabled = screen.getByRole("menuitem", { name: "Disabled" });
    const remove = screen.getByRole("menuitem", { name: "Remove" });

    fireEvent.keyDown(edit, { key: "ArrowDown" });
    expect(remove).toHaveFocus();
    expect(remove).toHaveAttribute("tabindex", "0");
    expect(edit).toHaveAttribute("tabindex", "-1");
    expect(disabled).not.toHaveFocus();
    fireEvent.keyDown(remove, { key: "ArrowDown" });
    expect(edit).toHaveFocus();
    fireEvent.keyDown(edit, { key: "ArrowUp" });
    expect(remove).toHaveFocus();
    fireEvent.keyDown(remove, { key: "Home" });
    expect(edit).toHaveFocus();
    fireEvent.keyDown(edit, { key: "End" });
    expect(remove).toHaveFocus();
  });

  it("closes on Tab without trapping focus and returns focus after an invoked action", async () => {
    const user = userEvent.setup();
    render(<MenuHarness />);
    const trigger = screen.getByRole("button", { name: "Open menu" });
    const after = screen.getByRole("button", { name: "After menu" });

    await user.click(trigger);
    await user.tab();
    expect(after).toHaveFocus();
    expect(screen.getByRole("menu", { name: "Example menu" })).toHaveAttribute(
      "data-motion-state",
      "closing",
    );

    await user.click(trigger);
    await user.click(screen.getByRole("menuitem", { name: "Remove" }));
    expect(trigger).toHaveFocus();
  });

  it("removes immediately when reduced motion is active", () => {
    render(
      <ReducedMotionProvider override>
        <MenuHarness />
      </ReducedMotionProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("menu", { name: "Example menu" })).not.toBeInTheDocument();
  });

  it("does not register with or invalidate the acrylic compositor", () => {
    const registry = createMaterialSurfaceRegistry(null);
    const notifySurfaceGeometryChanged = vi.fn();
    render(
      <MaterialSurfaceRegistrationProvider value={{ registry, notifySurfaceGeometryChanged }}>
        <MenuHarness initiallyOpen />
      </MaterialSurfaceRegistrationProvider>,
    );
    expect(registry.getSnapshot().surfaces).toHaveLength(0);
    expect(notifySurfaceGeometryChanged).not.toHaveBeenCalled();
    registry.dispose();
  });
});

function MenuHarness({ initiallyOpen = false }: { readonly initiallyOpen?: boolean }) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <>
      <button ref={anchorRef} onClick={() => setOpen(true)}>
        Open menu
      </button>
      <ContextMenu
        label="Example menu"
        open={open}
        onOpenChange={setOpen}
        position={{ left: 120, top: 80 }}
        returnFocusRef={anchorRef}
      >
        <ContextMenuItem>Edit</ContextMenuItem>
        <ContextMenuItem disabled>Disabled</ContextMenuItem>
        <ContextMenuDivider />
        <ContextMenuItem danger onClick={() => setOpen(false)}>
          Remove
        </ContextMenuItem>
      </ContextMenu>
      <button>After menu</button>
    </>
  );
}
