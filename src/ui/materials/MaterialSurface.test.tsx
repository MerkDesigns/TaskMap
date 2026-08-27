import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
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

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("MaterialSurface", () => {
  it("keeps the public element, ref, children, and ordinary DOM prop contract", () => {
    const ref = createRef<HTMLElement>();
    render(
      <MaterialSurface
        ref={ref}
        as="aside"
        material="acrylic-large"
        aria-label="Tools"
        className="feature-tools"
      >
        <button>Action</button>
      </MaterialSurface>,
    );

    const surface = screen.getByLabelText("Tools");
    expect(surface).toBe(ref.current);
    expect(surface.tagName).toBe("ASIDE");
    expect(surface).toHaveClass("taskmap-material-surface", "feature-tools");
    expect(screen.getByRole("button", { name: "Action" }).parentElement).toBe(surface);
  });

  it("renders Acrylic Large through the permanent two-pass native path", () => {
    render(<MaterialSurface material="acrylic-large">Large</MaterialSurface>);
    const surface = screen.getByText("Large");

    expect(surface).toHaveAttribute("data-material-strategy", "native-glass");
    expect(surface).toHaveAttribute("data-material-role", "large");
    expect(surface.style.getPropertyValue("--taskmap-material-preblur")).toBe("6px");
    expect(surface.style.getPropertyValue("--taskmap-material-interaction-preblur")).toBe("0px");
    expect(surface.style.getPropertyValue("--taskmap-material-content-clip-inset")).toBe("2px");
    expect(surface.style.getPropertyValue("--taskmap-material-blur")).toBe("60px");
    expect(surface.style.getPropertyValue("--taskmap-material-brightness")).toBe("0.82");
    expect(surface.style.getPropertyValue("--taskmap-material-border-brightness")).toBe("1");
    expect(surface.querySelector(".taskmap-material-native-glass__preblur")).toHaveAttribute(
      "data-enabled",
      "true",
    );
    expect(surface.querySelector(".taskmap-material-native-glass__backdrop")).toBeInTheDocument();
    expect(surface.querySelector(".taskmap-material-native-glass__rim-canvas")).toBeInTheDocument();
    const clip = surface.querySelector<HTMLElement>(".taskmap-material-native-glass__clip");
    const rim = surface.querySelector<HTMLElement>(".taskmap-material-native-glass__rim");
    expect(rim?.parentElement).toBe(surface);
    expect(clip).not.toContainElement(rim);
  });

  it("renders Acrylic Small with the same permanent two-pass recipe in every state", () => {
    render(<MaterialSurface material="acrylic-small">Small</MaterialSurface>);
    const surface = screen.getByText("Small");

    expect(surface).toHaveAttribute("data-material-strategy", "native-glass");
    expect(surface).toHaveAttribute("data-material-role", "small");
    expect(surface.style.getPropertyValue("--taskmap-material-radius")).toBe("13.5px");
    expect(surface.style.getPropertyValue("--taskmap-material-blur")).toBe("23.5px");
    expect(surface.style.getPropertyValue("--taskmap-material-preblur")).toBe("5px");
    expect(surface.style.getPropertyValue("--taskmap-material-content-clip-inset")).toBe("2px");
    expect(surface.style.getPropertyValue("--taskmap-material-brightness")).toBe("0.9");
    expect(surface.querySelector(".taskmap-material-native-glass__preblur")).toHaveAttribute(
      "data-enabled",
      "true",
    );
    expect(surface.querySelector(".taskmap-material-native-glass__preblur")).not.toHaveAttribute(
      "data-interaction-enabled",
    );
  });

  it("does not register Large or Small with the parked cached Canvas2D compositor", () => {
    const registry = createMaterialSurfaceRegistry(null);
    render(
      <MaterialSurfaceRegistrationProvider value={boundary(registry)}>
        <MaterialSurface material="acrylic-large">Large</MaterialSurface>
        <MaterialSurface material="acrylic-small">Small</MaterialSurface>
      </MaterialSurfaceRegistrationProvider>,
    );

    expect(registry.getSnapshot().surfaces).toEqual([]);
    expect(screen.getByText("Large")).not.toHaveAttribute("data-material-surface-id");
    expect(screen.getByText("Small")).not.toHaveAttribute("data-material-surface-id");
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

  it("preserves radius overrides, elevation, Opaque, and Cutout", () => {
    render(
      <>
        <MaterialSurface material="acrylic-large" radius={8} elevation="none">
          Flat
        </MaterialSurface>
        <MaterialSurface material="opaque">Opaque</MaterialSurface>
        <MaterialSurface material="cutout" radius={6}>
          Cutout
        </MaterialSurface>
      </>,
    );

    expect(screen.getByText("Flat").style.getPropertyValue("--taskmap-material-radius")).toBe(
      "8px",
    );
    expect(screen.getByText("Flat").style.getPropertyValue("--taskmap-material-shadow")).toBe(
      "none",
    );
    expect(screen.getByText("Opaque")).toHaveAttribute("data-material-strategy", "opaque");
    expect(
      screen.getByText("Opaque").style.getPropertyValue("--taskmap-material-content-clip-inset"),
    ).toBe("1px");
    expect(screen.getByText("Cutout")).toHaveAttribute("data-material-strategy", "css");
    expect(
      screen.getByText("Cutout").style.getPropertyValue("--taskmap-material-content-clip-inset"),
    ).toBe("1.5px");
  });

  it("does not expose backend tuning props", () => {
    expectTypeOf<MaterialSurfaceProps>().not.toHaveProperty("blur");
    expectTypeOf<MaterialSurfaceProps>().not.toHaveProperty("cacheScale");
    expectTypeOf<MaterialSurfaceProps>().not.toHaveProperty("worker");
    expectTypeOf<MaterialSurfaceProps>().not.toHaveProperty("tint");
  });

  it("keeps the reusable bright-selection effect on native Small", () => {
    render(
      <MaterialSurface material="acrylic-small" effect="bright-selection">
        Selection
      </MaterialSurface>,
    );
    expect(screen.getByText("Selection")).toHaveClass("taskmap-material-surface--bright-selection");
    expect(screen.getByText("Selection")).toHaveAttribute("data-material-strategy", "native-glass");
  });

  it("bounds nested Small overscan to its logical Large owner across transient classes", () => {
    const registry = createMaterialSurfaceRegistry(null);
    const registrationBoundary = {
      registry,
      notifySurfaceGeometryChanged: vi.fn(),
    };
    const view = (motionClass: string) => (
      <MaterialSurfaceRegistrationProvider value={registrationBoundary}>
        <MaterialSurface material="acrylic-large" data-testid="large-boundary">
          <MaterialSurface
            material="acrylic-small"
            className={motionClass}
            data-testid="small-surface"
          >
            Card
          </MaterialSurface>
        </MaterialSurface>
      </MaterialSurfaceRegistrationProvider>
    );
    const { rerender } = render(view("settled"));
    const large = screen.getByTestId("large-boundary");
    const small = screen.getByTestId("small-surface");
    vi.spyOn(large, "getBoundingClientRect").mockReturnValue(rectangle(100, 100, 300, 300));
    vi.spyOn(small, "getBoundingClientRect").mockReturnValue(rectangle(105, 120, 100, 100));

    fireEvent(window, new Event("resize"));
    expect(small).toHaveAttribute("data-material-sampling-boundary", "inherited");
    expect(overscan(small)).toEqual(["5.00px", "20.00px", "32.77px", "32.77px"]);

    rerender(view("is-dragging is-snapping"));
    fireEvent(window, new Event("resize"));
    expect(small).toHaveAttribute("data-material-sampling-boundary", "inherited");
    expect(overscan(small)).toEqual(["5.00px", "20.00px", "32.77px", "32.77px"]);
    expect(registry.getSnapshot().surfaces).toEqual([]);
  });

  it("routes the existing geometry invalidation seam to native surfaces", () => {
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

  it("coalesces resize-settled backdrop refreshes without starting a refresh loop", () => {
    const frames = new Map<number, FrameRequestCallback>();
    const requestFrame = vi.fn((callback: FrameRequestCallback) => {
      const id = frames.size + 1;
      frames.set(id, callback);
      return id;
    });
    vi.stubGlobal("requestAnimationFrame", requestFrame);
    render(<MaterialSurface material="acrylic-large">Large</MaterialSurface>);
    const surface = screen.getByText("Large");

    fireEvent(window, new Event("resize"));
    fireEvent(window, new Event("resize"));

    expect(requestFrame).toHaveBeenCalledOnce();
    expect(surface.style.getPropertyValue("--taskmap-material-backdrop-revision")).toBe("");

    frames.get(1)?.(0);

    expect(surface.style.getPropertyValue("--taskmap-material-backdrop-revision")).toBe("0.01px");
    expect(requestFrame).toHaveBeenCalledOnce();
  });

  it("cancels a pending resize-settled backdrop refresh during cleanup", () => {
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn(() => 41),
    );
    const cancelFrame = vi.fn();
    vi.stubGlobal("cancelAnimationFrame", cancelFrame);
    const { unmount } = render(<MaterialSurface material="acrylic-small">Small</MaterialSurface>);

    fireEvent(window, new Event("resize"));
    unmount();

    expect(cancelFrame).toHaveBeenCalledOnce();
    expect(cancelFrame).toHaveBeenCalledWith(41);
  });
});

function boundary(registry: MaterialSurfaceRegistry, notifySurfaceGeometryChanged = vi.fn()) {
  return { registry, notifySurfaceGeometryChanged };
}

function rectangle(left: number, top: number, width: number, height: number): DOMRect {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

function overscan(element: HTMLElement): string[] {
  return ["left", "top", "right", "bottom"].map((side) =>
    element.style.getPropertyValue(`--taskmap-material-overscan-${side}`),
  );
}
