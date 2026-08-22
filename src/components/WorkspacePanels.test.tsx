import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TaskCanvas } from "../types";
import { MaterialSurfaceRegistrationProvider } from "../ui/materials/MaterialSurfaceRegistration";
import { createMaterialSurfaceRegistry } from "../ui/materials/materialSurfaceRegistry";
import { readNativeGlassDiagnostics } from "../ui/materials/SharedSmallGlassPlane";
import { ReducedMotionProvider } from "../ui/motion/reducedMotionPreference";
import { WorkspaceSidePanel } from "../ui/patterns/workspace";
import { CanvasManager } from "./CanvasManager";
import { ExtensionsPanel } from "./ExtensionsPanel";

afterEach(cleanup);

describe("C2C workspace panels", () => {
  it("uses the same Acrylic Large side-panel surface for both production shells", () => {
    const registry = createMaterialSurfaceRegistry(null);
    render(
      <MaterialSurfaceRegistrationProvider
        value={{ registry, notifySurfaceGeometryChanged: vi.fn() }}
      >
        <ReducedMotionProvider override>
          <CanvasManager {...canvasManagerProps()} />
          <ExtensionsPanel closing={false} onDropExtension={vi.fn()} />
        </ReducedMotionProvider>
      </MaterialSurfaceRegistrationProvider>,
    );

    for (const label of ["Canvases panel", "Extensions panel"]) {
      const panel = screen.getByLabelText(label);
      expect(panel).toHaveAttribute("data-material", "acrylic-large");
      expect(panel).toHaveAttribute("data-material-elevation", "default");
      expect(panel.style.getPropertyValue("--taskmap-material-radius")).toBe("23px");
    }
    expect(document.querySelectorAll('[data-material-strategy="native-glass"]')).toHaveLength(16);
    expect(registry.getSnapshot().surfaces).toEqual([]);
    expect(document.querySelectorAll(".taskmap-scroll-area--hidden-scrollbar")).toHaveLength(1);
    expect(document.querySelectorAll("[data-canvas-browser-viewport]")).toHaveLength(1);
    registry.dispose();
  });

  it("keeps both embedded variants plain and unregistered", () => {
    const registry = createMaterialSurfaceRegistry(null);
    const { container } = render(
      <MaterialSurfaceRegistrationProvider
        value={{ registry, notifySurfaceGeometryChanged: vi.fn() }}
      >
        <CanvasManager {...canvasManagerProps()} embedded />
        <ExtensionsPanel closing={false} embedded onDropExtension={vi.fn()} />
      </MaterialSurfaceRegistrationProvider>,
    );

    expect(registry.getSnapshot().surfaces).toHaveLength(0);
    expect(container.querySelector('[data-material="acrylic-large"]')).toBeNull();
    expect(screen.getByRole("heading", { name: "Canvas Browser" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Extensions" })).toBeInTheDocument();
    registry.dispose();
  });

  it("uses one Large shell while shared-panel cards retain Acrylic Small", () => {
    const registry = createMaterialSurfaceRegistry(null);
    const { container } = render(
      <MaterialSurfaceRegistrationProvider
        value={{ registry, notifySurfaceGeometryChanged: vi.fn() }}
      >
        <ReducedMotionProvider override>
          <WorkspaceSidePanel closing={false} label="Shared panel">
            <CanvasManager {...canvasManagerProps()} sharedPanel />
            <ExtensionsPanel closing={false} sharedPanel onDropExtension={vi.fn()} />
          </WorkspaceSidePanel>
        </ReducedMotionProvider>
      </MaterialSurfaceRegistrationProvider>,
    );

    expect(container.querySelectorAll('[data-material="acrylic-large"]')).toHaveLength(1);
    expect(container.querySelector('[data-canvas-card-id="canvas-a"]')).toHaveAttribute(
      "data-material",
      "acrylic-small",
    );
    expect(container.querySelector('[data-canvas-card-id="canvas-a"]')).toHaveAttribute(
      "data-material-backdrop-source",
      "shared",
    );
    expect(container.querySelector('[data-shared-small-glass-plane="active"]')).not.toBeNull();
    expect(readNativeGlassDiagnostics(container)).toMatchObject({
      sharedSmallPlaneActive: true,
    });
    expect(container.querySelector('[data-extension-card-id="privacy"]')).toHaveAttribute(
      "data-material",
      "acrylic-small",
    );
    registry.dispose();
  });

  it("reduces ten Canvas Browser card backdrops to one bounded shared plane", () => {
    const props = canvasManagerProps();
    props.canvases = Array.from({ length: 10 }, (_, index) => canvas(`canvas-${index}`));
    props.activeCanvasId = "canvas-0";
    const view = () => (
      <ReducedMotionProvider override>
        <CanvasManager {...props} />
      </ReducedMotionProvider>
    );
    const { container, rerender } = render(view());

    expect(container.querySelectorAll("[data-canvas-card-id]")).toHaveLength(10);
    expect(
      container.querySelectorAll('[data-canvas-card-id][data-material-backdrop-source="shared"]'),
    ).toHaveLength(10);
    expect(container.querySelectorAll('[data-shared-small-glass-plane="active"]')).toHaveLength(1);
    expect(readNativeGlassDiagnostics(container)).toMatchObject({
      localMaterialBackdropFilterCount: 0,
      nativeBackdropSurfaceCount: 1,
      nativeBackdropFilterLayerCount: 1,
      sharedSmallBatchCount: 1,
      sharedSmallPlaneActive: true,
    });

    props.canvases = Array.from({ length: 100 }, (_, index) => canvas(`canvas-${index}`));
    rerender(view());
    expect(container.querySelectorAll("[data-canvas-card-id]")).toHaveLength(100);
    expect(readNativeGlassDiagnostics(container)).toMatchObject({
      localMaterialBackdropFilterCount: 0,
      nativeBackdropFilterLayerCount: 1,
      sharedSmallBatchCount: 1,
    });
  });

  it("keeps the retained inactive Canvas view free of filters and wheel routing", () => {
    const { container } = render(
      <ReducedMotionProvider override>
        <CanvasManager {...canvasManagerProps()} active={false} sharedPanel />
      </ReducedMotionProvider>,
    );
    const viewport = container.querySelector<HTMLElement>("[data-canvas-browser-viewport]")!;
    const wheel = new WheelEvent("wheel", { cancelable: true, deltaY: 100 });
    viewport.dispatchEvent(wheel);

    expect(wheel.defaultPrevented).toBe(false);
    expect(readNativeGlassDiagnostics(container)).toMatchObject({
      nativeBackdropFilterLayerCount: 0,
      sharedSmallBatchCount: 0,
    });
  });

  it("preserves CanvasManager header, selection, and create callbacks", async () => {
    const user = userEvent.setup();
    const props = canvasManagerProps();
    const { container } = render(<CanvasManager {...props} embedded />);

    expect(screen.getByLabelText("1 canvases")).toHaveTextContent("1");
    await user.click(screen.getByRole("button", { name: "Minimal view" }));
    expect(props.onMinimalViewChange).toHaveBeenCalledWith(true);

    fireEvent.click(container.querySelector('[data-canvas-card-id="canvas-a"]') as HTMLElement);
    expect(props.onSelectCanvas).toHaveBeenCalledWith("canvas-a");

    await user.click(screen.getByRole("button", { name: "Create canvas" }));
    expect(screen.getByPlaceholderText("Canvas name")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Create" }));
    expect(props.onCreateCanvas).toHaveBeenCalledWith({
      name: "Canvas 2",
      width: 3000,
      height: 3000,
    });
  });

  it("keeps the Extensions filter portal outside the migrated shell", async () => {
    const user = userEvent.setup();
    render(<ExtensionsPanel closing={false} onDropExtension={vi.fn()} />);
    const panel = screen.getByLabelText("Extensions panel");

    await user.click(screen.getByTitle("Filter by element"));
    const filterMenu = screen.getByRole("button", { name: /Mindmaps/ }).parentElement;
    expect(filterMenu).not.toBeNull();
    expect(panel.contains(filterMenu)).toBe(false);
    expect(filterMenu?.parentElement).toBe(document.body);
  });
});

function canvasManagerProps() {
  return {
    canvases: [canvas()],
    activeCanvasId: "canvas-a",
    closing: false,
    minimalView: false,
    viewportWidth: 1200,
    viewportHeight: 800,
    onMinimalViewChange: vi.fn(),
    onCreateCanvas: vi.fn(),
    onSelectCanvas: vi.fn(),
    onUpdateCanvas: vi.fn(),
    onDeleteCanvas: vi.fn(),
    onReorderCanvases: vi.fn(),
  };
}

function canvas(id = "canvas-a"): TaskCanvas {
  return {
    id,
    name: "Canvas A",
    width: 3000,
    height: 3000,
    containers: [],
    textCards: [],
    textBlocks: [],
    images: [],
    mindmapConnections: [],
    pan: { x: 0, y: 0 },
    zoom: 1,
  };
}
