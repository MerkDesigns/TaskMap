import { cleanup, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MaterialSurfaceRegistrationProvider } from "../materials/MaterialSurfaceRegistration";
import { createMaterialSurfaceRegistry } from "../materials/materialSurfaceRegistry";
import { ContextMenu, ContextMenuItem } from "../primitives";

afterEach(cleanup);

describe("UI Lab context-menu opaque material integration", () => {
  it("does not register with or invalidate the acrylic compositor", () => {
    const registry = createMaterialSurfaceRegistry(null);
    const notifySurfaceGeometryChanged = vi.fn();
    function Harness() {
      const returnFocusRef = useRef<HTMLButtonElement>(null);
      return (
        <>
          <button ref={returnFocusRef}>Anchor</button>
          <ContextMenu
            label="Integration menu"
            open
            onOpenChange={() => undefined}
            position={{ left: 24, top: 32 }}
            returnFocusRef={returnFocusRef}
          >
            <ContextMenuItem>Action</ContextMenuItem>
          </ContextMenu>
        </>
      );
    }

    render(
      <MaterialSurfaceRegistrationProvider
        value={{
          registry,
          notifySurfaceGeometryChanged,
        }}
      >
        <Harness />
      </MaterialSurfaceRegistrationProvider>,
    );
    expect(screen.getByRole("menu")).toHaveAttribute("data-material", "opaque");
    expect(registry.getSnapshot().surfaces).toHaveLength(0);
    expect(notifySurfaceGeometryChanged).not.toHaveBeenCalled();
  });
});
