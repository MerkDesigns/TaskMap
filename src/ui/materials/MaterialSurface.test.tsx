import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef, StrictMode } from "react";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { MaterialPlaneProvider } from "./MaterialPlane";
import { MaterialSurface, type MaterialSurfaceProps } from "./MaterialSurface";
import {
  MaterialSurfaceRegistrationProvider,
  useMaterialSurfaceGeometryInvalidation,
} from "./MaterialSurfaceRegistration";
import {
  createMaterialSurfaceRegistry,
  type MaterialSurfaceRegistry,
} from "./materialSurfaceRegistry";

afterEach(cleanup);

describe("MaterialSurface", () => {
  it("selects the registered definition and forwards ordinary DOM props", () => {
    const { container } = render(
      <MaterialSurface material="acrylic-large" aria-label="Tools" className="feature-tools">
        Tools
      </MaterialSurface>,
    );

    const surface = container.firstElementChild;
    expect(screen.getByLabelText("Tools")).toHaveTextContent("Tools");
    expect(surface).toHaveClass("taskmap-material-surface", "feature-tools");
    expect(surface).toHaveAttribute("data-material", "acrylic-large");
    expect(surface).toHaveAttribute("data-material-strategy", "cached-acrylic");
  });

  it("defaults to base, inherits modal, and permits an explicit plane override", () => {
    render(
      <>
        <MaterialSurface material="acrylic-large">Default</MaterialSurface>
        <MaterialPlaneProvider plane="modal">
          <MaterialSurface material="acrylic-small">Inherited</MaterialSurface>
          <MaterialSurface material="acrylic-small" plane="base">
            Override
          </MaterialSurface>
        </MaterialPlaneProvider>
      </>,
    );

    expect(screen.getByText("Default")).toHaveAttribute("data-material-plane", "base");
    expect(screen.getByText("Inherited")).toHaveAttribute("data-material-plane", "modal");
    expect(screen.getByText("Override")).toHaveAttribute("data-material-plane", "base");
  });

  it("applies default and overridden geometry and elevation contracts", () => {
    render(
      <>
        <MaterialSurface material="acrylic-small">Default geometry</MaterialSurface>
        <MaterialSurface material="acrylic-large" radius={8} elevation="none">
          Flat geometry
        </MaterialSurface>
        <MaterialSurface material="cutout" radius={6}>
          Recessed geometry
        </MaterialSurface>
      </>,
    );

    const defaultSurface = screen.getByText("Default geometry");
    const flatSurface = screen.getByText("Flat geometry");
    const cutout = screen.getByText("Recessed geometry");

    expect(defaultSurface.style.getPropertyValue("--taskmap-material-radius")).toBe("12px");
    expect(defaultSurface.style.getPropertyValue("--taskmap-material-shadow")).toContain(
      "5px 12px",
    );
    expect(flatSurface.style.getPropertyValue("--taskmap-material-radius")).toBe("8px");
    expect(flatSurface.style.getPropertyValue("--taskmap-material-shadow")).toBe("none");
    expect(flatSurface).toHaveAttribute("data-material-elevation", "none");
    expect(cutout.style.getPropertyValue("--taskmap-material-radius")).toBe("6px");
    expect(cutout.style.getPropertyValue("--taskmap-material-shadow")).toContain("inset");
  });

  it("projects all three registered highlight stops into presentation variables", () => {
    render(<MaterialSurface material="acrylic-large">Highlight</MaterialSurface>);

    const surface = screen.getByText("Highlight");
    expect(surface.style.getPropertyValue("--taskmap-material-highlight-start-offset")).toBe("0%");
    expect(surface.style.getPropertyValue("--taskmap-material-highlight-start-multiplier")).toBe(
      "1",
    );
    expect(surface.style.getPropertyValue("--taskmap-material-highlight-middle-offset")).toBe(
      "38%",
    );
    expect(surface.style.getPropertyValue("--taskmap-material-highlight-middle-multiplier")).toBe(
      "0.4",
    );
    expect(surface.style.getPropertyValue("--taskmap-material-highlight-end-offset")).toBe("72%");
    expect(surface.style.getPropertyValue("--taskmap-material-highlight-end-multiplier")).toBe("0");
  });

  it("supports a bounded semantic element and forwards its ref", () => {
    const ref = createRef<HTMLElement>();
    render(
      <MaterialSurface ref={ref} as="aside" material="acrylic-large">
        Side panel
      </MaterialSurface>,
    );

    expect(ref.current).toBeInstanceOf(HTMLElement);
    expect(ref.current?.tagName).toBe("ASIDE");
  });

  it("does not expose compositor tuning props", () => {
    expectTypeOf<MaterialSurfaceProps>().not.toHaveProperty("blur");
    expectTypeOf<MaterialSurfaceProps>().not.toHaveProperty("cacheScale");
    expectTypeOf<MaterialSurfaceProps>().not.toHaveProperty("worker");
    expectTypeOf<MaterialSurfaceProps>().not.toHaveProperty("tint");
  });

  it("registers only cached acrylic and updates explicit plane and radius", () => {
    const registry = createMaterialSurfaceRegistry(null);
    const closest = vi.spyOn(HTMLElement.prototype, "closest");
    const { rerender } = render(
      <MaterialSurfaceRegistrationProvider value={boundary(registry)}>
        <MaterialSurface material="acrylic-large">Registered</MaterialSurface>
      </MaterialSurfaceRegistrationProvider>,
    );
    expect(registry.getSnapshot().surfaces).toHaveLength(1);
    rerender(
      <MaterialSurfaceRegistrationProvider value={boundary(registry)}>
        <MaterialSurface material="acrylic-small" plane="modal" radius={8}>
          Registered
        </MaterialSurface>
      </MaterialSurfaceRegistrationProvider>,
    );
    expect(registry.getSnapshot().surfaces[0]).toMatchObject({
      material: "acrylic-small",
      plane: "modal",
      radiusPx: 8,
    });
    rerender(
      <MaterialSurfaceRegistrationProvider value={boundary(registry)}>
        <MaterialSurface material="cutout" radius={6}>
          Registered
        </MaterialSurface>
      </MaterialSurfaceRegistrationProvider>,
    );
    expect(registry.getSnapshot().surfaces).toHaveLength(0);
    expect(closest).not.toHaveBeenCalled();
    closest.mockRestore();
  });

  it("keeps one live registration through the StrictMode effect probe", () => {
    const registry = createMaterialSurfaceRegistry(null);
    const { unmount } = render(
      <StrictMode>
        <MaterialSurfaceRegistrationProvider value={boundary(registry)}>
          <MaterialSurface material="acrylic-large">Strict surface</MaterialSurface>
        </MaterialSurfaceRegistrationProvider>
      </StrictMode>,
    );
    expect(registry.getSnapshot().surfaces).toHaveLength(1);
    unmount();
    expect(registry.getSnapshot().surfaces).toHaveLength(0);
  });

  it("exposes the cheap geometry invalidation seam through the material boundary", () => {
    const notify = vi.fn();
    const registry = createMaterialSurfaceRegistry(null);
    function MotionProbe() {
      const invalidateGeometry = useMaterialSurfaceGeometryInvalidation();
      return <button onClick={invalidateGeometry}>Move surface</button>;
    }
    render(
      <MaterialSurfaceRegistrationProvider value={boundary(registry, notify)}>
        <MotionProbe />
      </MaterialSurfaceRegistrationProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Move surface" }));

    expect(notify).toHaveBeenCalledOnce();
  });
});

function boundary(registry: MaterialSurfaceRegistry, notifySurfaceGeometryChanged = vi.fn()) {
  return { registry, notifySurfaceGeometryChanged };
}
