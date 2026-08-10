import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ContainerElement, ImageElement, TextBlockElement, TextCardElement } from "../types";
import { MaterialSurfaceRegistrationProvider } from "../ui/materials/MaterialSurfaceRegistration";
import { createMaterialSurfaceRegistry } from "../ui/materials/materialSurfaceRegistry";
import { ReducedMotionProvider } from "../ui/motion/reducedMotionPreference";
import { Minimap } from "./Minimap";

afterEach(cleanup);

describe("C2F Minimap", () => {
  it("uses one Acrylic Large shell, one unregistered Cutout interior, and the reset primitive", () => {
    const registry = createMaterialSurfaceRegistry(null);
    const onResetZoom = vi.fn();
    renderMinimap({ registry, onResetZoom, zoom: 1.254 });

    const shell = screen.getByLabelText("Minimap");
    const interior = document.querySelector("[data-minimap-viewport-surface]");
    expect(shell).toHaveAttribute("data-material", "acrylic-large");
    expect(shell.style.getPropertyValue("--taskmap-material-radius")).toBe("12px");
    expect(interior).toHaveAttribute("data-material", "cutout");
    expect(interior).not.toHaveAttribute("data-material-surface-id");
    expect((interior as HTMLElement).style.getPropertyValue("--taskmap-material-radius")).toBe(
      "6px",
    );
    expect(registry.getSnapshot().surfaces).toHaveLength(1);
    expect(screen.getByText("125%")).toBeInTheDocument();

    const reset = screen.getByRole("button", { name: "Reset zoom" });
    expect(reset).toHaveAttribute("title", "Reset zoom");
    fireEvent.click(reset);
    expect(onResetZoom).toHaveBeenCalledOnce();
    registry.dispose();
  });

  it("keeps projection geometry, minimum pixels, and user accent colors intact", () => {
    const registry = createMaterialSurfaceRegistry(null);
    renderMinimap({ registry });

    const interior = document.querySelector("[data-minimap-viewport-surface]") as HTMLElement;
    expect(interior.style.width).toBe("176px");
    expect(interior.style.height).toBe("88px");

    const container = element("container-a");
    const textBlock = element("text-block-a");
    const textCard = element("text-card-a");
    const image = element("image-a");
    expect(container).toHaveStyle({ width: "4.4px", height: "4px" });
    expect(textBlock).toHaveStyle({ width: "4px", height: "4px" });
    expect(textCard).toHaveStyle({ width: "9.68px", height: "3px" });
    expect(image).toHaveStyle({ width: "3px", height: "3px" });
    expect(container).toHaveStyle({ borderColor: "rgb(171, 52, 86)" });
    expect(textBlock).toHaveStyle({ borderColor: "rgb(53, 188, 120)" });
    expect(textCard).toHaveStyle({ borderColor: "rgb(108, 92, 231)" });
    expect(image).toHaveStyle({ borderColor: "rgb(68, 136, 204)" });
    expect(document.querySelector("[data-minimap-viewport-indicator]")).toHaveClass(
      "taskmap-minimap-viewport-indicator",
    );
    registry.dispose();
  });

  it("introduces no minimap navigation interaction beyond reset", () => {
    const registry = createMaterialSurfaceRegistry(null);
    const onResetZoom = vi.fn();
    renderMinimap({ registry, onResetZoom });
    const interior = document.querySelector("[data-minimap-viewport-surface]") as HTMLElement;

    fireEvent.click(interior, { clientX: 40, clientY: 20 });
    fireEvent.pointerDown(interior, { clientX: 40, clientY: 20 });
    fireEvent.pointerMove(interior, { clientX: 60, clientY: 30 });
    expect(onResetZoom).not.toHaveBeenCalled();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    registry.dispose();
  });
});

function renderMinimap({
  registry,
  onResetZoom = vi.fn(),
  zoom = 1,
}: {
  registry: ReturnType<typeof createMaterialSurfaceRegistry>;
  onResetZoom?: () => void;
  zoom?: number;
}) {
  return render(
    <MaterialSurfaceRegistrationProvider
      value={{ registry, notifySurfaceGeometryChanged: vi.fn() }}
    >
      <ReducedMotionProvider override>
        <Minimap
          elements={containers}
          textBlocks={textBlocks}
          textCards={textCards}
          images={images}
          mindmapConnections={[]}
          canvasWidth={4000}
          canvasHeight={2000}
          visible
          zoom={zoom}
          viewportWorld={{ x: 100, y: 200, width: 1000, height: 500 }}
          onResetZoom={onResetZoom}
        />
      </ReducedMotionProvider>
    </MaterialSurfaceRegistrationProvider>,
  );
}

function element(id: string): HTMLElement {
  const match = document.querySelector(`[data-minimap-id="${id}"]`);
  if (!(match instanceof HTMLElement)) throw new Error(`Missing minimap element ${id}`);
  return match;
}

const containers: ContainerElement[] = [
  {
    id: "container-a",
    name: "Container",
    x: 100,
    y: 200,
    width: 100,
    height: 80,
    accent: "#ab3456",
  },
];

const textBlocks: TextBlockElement[] = [
  {
    id: "text-block-a",
    name: "Block",
    text: "Block",
    x: 500,
    y: 300,
    width: 80,
    height: 60,
    accent: "#35bc78",
  },
];

const textCards: TextCardElement[] = [
  { id: "text-card-a", text: "Card", x: 800, y: 500, accent: "#6c5ce7" },
];

const images: ImageElement[] = [
  {
    id: "image-a",
    x: 1200,
    y: 700,
    width: 40,
    height: 40,
    accent: "#4488cc",
  },
];
