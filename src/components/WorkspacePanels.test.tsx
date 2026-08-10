import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TaskCanvas } from "../types";
import { MaterialSurfaceRegistrationProvider } from "../ui/materials/MaterialSurfaceRegistration";
import { createMaterialSurfaceRegistry } from "../ui/materials/materialSurfaceRegistry";
import { ReducedMotionProvider } from "../ui/motion/reducedMotionPreference";
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
      expect(panel.style.getPropertyValue("--taskmap-material-radius")).toBe("12px");
    }
    expect(
      registry.getSnapshot().surfaces.filter((surface) => surface.material === "acrylic-large"),
    ).toHaveLength(2);
    expect(
      registry.getSnapshot().surfaces.filter((surface) => surface.material === "acrylic-small"),
    ).toHaveLength(1);
    expect(document.querySelectorAll(".taskmap-scroll-area--hidden-scrollbar")).toHaveLength(2);
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
    expect(screen.getByRole("heading", { name: "Canvases" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Extensions" })).toBeInTheDocument();
    registry.dispose();
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

function canvas(): TaskCanvas {
  return {
    id: "canvas-a",
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
