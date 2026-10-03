import { act, cleanup, createEvent, fireEvent, render, screen } from "@testing-library/react";
import { createCanvasInteractionController } from "../app/interactions/canvasInteractionController";
import { createViewport } from "../canvas/geometry/viewportMath";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ContainerElement, ImageElement, TextBlockElement, TextCardElement } from "../types";
import { ReducedMotionProvider } from "../ui/motion/reducedMotionPreference";
import { Minimap } from "./Minimap";

afterEach(cleanup);

describe("Minimap", () => {
  it("updates only camera presentation without rebuilding document projection on pan/zoom", () => {
    const controller = createCanvasInteractionController({
      canvasKey: "a",
      viewport: createViewport({ x: 0, y: 0 }, 1, { width: 800, height: 600 }),
      commitPort: { commitMove: vi.fn(), commitResize: vi.fn(), commitLayerOrder: vi.fn() },
    });
    const projectionReads = vi.spyOn(containers, "map");
    renderMinimap({ controller });
    projectionReads.mockClear();
    const originalElement = element("container-a");
    act(() => controller.beginPan(1, { x: 0, y: 0 }));
    act(() =>
      controller.updatePointer({ pointerId: 1, screen: { x: -200, y: -100 }, snapping: false }),
    );
    expect(document.querySelector("[data-minimap-viewport-indicator]")).toHaveStyle({
      left: "8.8px",
      top: "4.4px",
      width: "35.2px",
      height: "26.4px",
    });
    act(() => controller.wheelZoom({ x: 200, y: 200 }, -100));
    expect(document.querySelector(".taskmap-minimap-zoom")).toHaveTextContent(
      `${Math.round(controller.getSnapshot().viewport.zoom * 100)}%`,
    );
    expect(element("container-a")).toBe(originalElement);
    expect(projectionReads).not.toHaveBeenCalled();
    projectionReads.mockRestore();
  });

  it("uses one Acrylic Large shell, one Cutout interior, and the reset primitive", () => {
    const onResetZoom = vi.fn();
    renderMinimap({ onResetZoom, zoom: 1.254 });

    const shell = screen.getByLabelText("Minimap");
    const interior = document.querySelector("[data-minimap-viewport-surface]");
    expect(shell).toHaveAttribute("data-material", "acrylic-large");
    expect(shell.style.getPropertyValue("--taskmap-material-radius")).toBe("12px");
    expect(interior).toHaveAttribute("data-material", "cutout");
    expect(interior).not.toHaveAttribute("data-material-surface-id");
    expect((interior as HTMLElement).style.getPropertyValue("--taskmap-material-radius")).toBe(
      "6px",
    );
    expect(shell).toHaveAttribute("data-material-strategy", "native-glass");
    expect(screen.getByText("125%")).toBeInTheDocument();

    const reset = screen.getByRole("button", { name: "Reset zoom" });
    expect(reset).toHaveAttribute("title", "Reset zoom");
    fireEvent.click(reset);
    expect(onResetZoom).toHaveBeenCalledOnce();
  });

  it("keeps projection geometry, minimum pixels, and user accent colors intact", () => {
    renderMinimap({});

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
  });

  it("centres the camera where the map is pressed and follows the drag", () => {
    const { controller, interior } = navigableMinimap();

    press(interior, "pointerDown", 88, 44);
    expect(cameraCentre(controller)).toEqual({ x: 2000, y: 1000 });
    press(interior, "pointerMove", 132, 44);
    expect(cameraCentre(controller)).toEqual({ x: 3000, y: 1000 });
    press(interior, "pointerUp", 132, 44);
  });

  it("drags the viewport indicator from where it was grabbed, without jumping", () => {
    const { controller, interior } = navigableMinimap();
    const before = cameraCentre(controller);

    // The camera shows world x 0..800, y 0..600: minimap x 0..35.2, y 0..26.4.
    press(interior, "pointerDown", 10, 10);
    expect(cameraCentre(controller)).toEqual(before);
    press(interior, "pointerMove", 32, 21);
    expect(cameraCentre(controller)).toEqual({ x: before.x + 500, y: before.y + 250 });
    press(interior, "pointerUp", 32, 21);
  });

  it("asks to stay visible while hovered or dragged", () => {
    const onHoldChange = vi.fn();
    const { interior } = navigableMinimap({ onHoldChange });
    const shell = screen.getByLabelText("Minimap");

    fireEvent.pointerEnter(shell);
    expect(onHoldChange).toHaveBeenLastCalledWith(true);
    press(interior, "pointerDown", 88, 44);
    fireEvent.pointerLeave(shell);
    expect(onHoldChange).toHaveBeenCalledTimes(1);
    press(interior, "pointerUp", 88, 44);
    expect(onHoldChange).toHaveBeenLastCalledWith(false);
  });

  it("is not navigable without a camera controller", () => {
    renderMinimap({});
    const interior = document.querySelector("[data-minimap-viewport-surface]") as HTMLElement;

    expect(interior).not.toHaveAttribute("data-navigable");
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });
});

function renderMinimap({
  controller,
  onResetZoom = vi.fn(),
  onHoldChange,
  zoom = 1,
}: {
  controller?: ReturnType<typeof createCanvasInteractionController>;
  onResetZoom?: () => void;
  onHoldChange?: (held: boolean) => void;
  zoom?: number;
}) {
  return render(
    <>
      <ReducedMotionProvider override>
        <Minimap
          controller={controller}
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
          onHoldChange={onHoldChange}
        />
      </ReducedMotionProvider>
    </>,
  );
}

function navigableMinimap({ onHoldChange }: { onHoldChange?: (held: boolean) => void } = {}) {
  const controller = createCanvasInteractionController({
    canvasKey: "a",
    viewport: createViewport({ x: 0, y: 0 }, 1, { width: 800, height: 600 }),
    commitPort: { commitMove: vi.fn(), commitResize: vi.fn(), commitLayerOrder: vi.fn() },
  });
  renderMinimap({ controller, onHoldChange });
  const interior = document.querySelector("[data-minimap-viewport-surface]") as HTMLElement;
  // jsdom has no layout: the 176 x 88 map maps onto the 4000 x 2000 canvas.
  interior.getBoundingClientRect = () => new DOMRect(0, 0, 176, 88);
  interior.setPointerCapture = vi.fn();
  interior.hasPointerCapture = () => true;
  interior.releasePointerCapture = vi.fn();
  return { controller, interior };
}

/** jsdom has no PointerEvent, so the generic event it creates carries no pointer fields. */
function press(
  target: HTMLElement,
  type: "pointerDown" | "pointerMove" | "pointerUp",
  clientX: number,
  clientY: number,
) {
  const event = createEvent[type](target);
  Object.defineProperty(event, "clientX", { value: clientX });
  Object.defineProperty(event, "clientY", { value: clientY });
  Object.defineProperty(event, "button", { value: 0 });
  Object.defineProperty(event, "pointerId", { value: 1 });
  act(() => {
    fireEvent(target, event);
  });
}

function cameraCentre(controller: ReturnType<typeof createCanvasInteractionController>) {
  const { pan, zoom, screen } = controller.getSnapshot().viewport;
  return {
    x: Math.round((screen.width / 2 - pan.x) / zoom),
    y: Math.round((screen.height / 2 - pan.y) / zoom),
  };
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
