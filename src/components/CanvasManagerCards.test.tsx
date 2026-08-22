import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TaskCanvas } from "../types";
import { MaterialSurfaceRegistrationProvider } from "../ui/materials/MaterialSurfaceRegistration";
import { readNativeGlassDiagnostics } from "../ui/materials/SharedSmallGlassPlane";
import { createMaterialSurfaceRegistry } from "../ui/materials/materialSurfaceRegistry";
import { ReducedMotionProvider } from "../ui/motion/reducedMotionPreference";
import { CANVAS_BROWSER_LAYOUT } from "../ui/patterns/workspace/canvasBrowserLayout";
import { CanvasManager } from "./CanvasManager";

const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  if (originalScrollIntoView) HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
});

describe("C2D Canvas Browser cards", () => {
  it("accepts temporary browser and full-card radius overrides", () => {
    const registry = createMaterialSurfaceRegistry(null);
    const { container } = renderProduction([canvas("canvas-a")], registry, {
      panelRadius: 29,
      cardRadius: 17,
    });
    const panel = container.querySelector<HTMLElement>("[data-canvas-browser]");
    const card = container.querySelector<HTMLElement>('[data-canvas-card-id="canvas-a"]');

    expect(panel?.style.getPropertyValue("--taskmap-material-radius")).toBe("29px");
    expect(card?.style.getPropertyValue("--taskmap-material-radius")).toBe("17px");
    registry.dispose();
  });

  it("maps full production cards to Acrylic Small and previews to unregistered Cutout", () => {
    const registry = createMaterialSurfaceRegistry(null);
    const { container } = renderProduction([canvas("canvas-a")], registry);
    const card = container.querySelector('[data-canvas-card-id="canvas-a"]');
    const preview = card?.querySelector('[data-material="cutout"]');

    expect(card).toHaveAttribute("data-material", "acrylic-small");
    expect(card).toHaveAttribute("data-material-strategy", "native-glass");
    expect(card).toHaveAttribute("data-canvas-card-mode", "full");
    expect((card as HTMLElement).style.getPropertyValue("--taskmap-material-radius")).toBe(
      "13.5px",
    );
    expect(preview).toHaveAttribute("data-material", "cutout");
    expect((preview as HTMLElement).style.getPropertyValue("--taskmap-material-radius")).toBe(
      "8px",
    );
    expect(card).toHaveAttribute("aria-current", "true");
    expect(card).not.toHaveClass("taskmap-material-surface--bright-selection");
    expect(registry.getSnapshot().surfaces).toEqual([]);
    registry.dispose();
  });

  it("uses the accepted minimal Acrylic Small geometry", () => {
    const registry = createMaterialSurfaceRegistry(null);
    const { container } = renderProduction([canvas("canvas-a")], registry, { minimalView: true });
    const card = container.querySelector('[data-canvas-card-id="canvas-a"]') as HTMLElement;

    expect(card).toHaveAttribute("data-material", "acrylic-small");
    expect(card).toHaveAttribute("data-canvas-card-mode", "minimal");
    expect(card.style.getPropertyValue("--taskmap-material-radius")).toBe("8px");
    expect(card.querySelector('[data-material="cutout"]')).toBeNull();
    registry.dispose();
  });

  it("keeps embedded cards and previews outside cached-acrylic registration", () => {
    const registry = createMaterialSurfaceRegistry(null);
    const { container } = render(
      <MaterialSurfaceRegistrationProvider
        value={{ registry, notifySurfaceGeometryChanged: vi.fn() }}
      >
        <CanvasManager {...canvasManagerProps([canvas("canvas-a")])} embedded />
      </MaterialSurfaceRegistrationProvider>,
    );
    const card = container.querySelector('[data-canvas-card-id="canvas-a"]');

    expect(card).toHaveAttribute("data-material", "opaque");
    expect(card?.querySelector('[data-material="cutout"]')).toBeInTheDocument();
    expect(registry.getSnapshot().surfaces).toHaveLength(0);
    registry.dispose();
  });

  it("preserves preview projection, layering, user colors, and transparent images", () => {
    const fixture = canvas("canvas-a", {
      pan: { x: -100, y: -40 },
      zoom: 2,
      previewViewport: { width: 960, height: 640 },
      containers: [
        {
          id: "container-a",
          name: "Container",
          x: 60,
          y: 30,
          width: 100,
          height: 50,
          accent: "#123456",
          layer: 3,
        },
      ],
      textBlocks: [
        {
          id: "text-a",
          name: "Text",
          text: "Text",
          x: 70,
          y: 40,
          width: 80,
          height: 40,
          accent: "#abcdef",
          layer: 5,
        },
      ],
      images: [
        {
          id: "image-a",
          x: 80,
          y: 50,
          width: 60,
          height: 30,
          accent: "#fedcba",
          layer: 7,
          background: false,
        },
      ],
    });
    const { container } = render(<CanvasManager {...canvasManagerProps([fixture])} embedded />);
    const containerPreview = container.querySelector(
      '[data-canvas-preview-container="container-a"]',
    ) as HTMLElement;
    const textPreview = container.querySelector(
      '[data-canvas-preview-text-block="text-a"]',
    ) as HTMLElement;
    const imagePreview = container.querySelector(
      '[data-canvas-preview-image="image-a"]',
    ) as HTMLElement;

    const expectedOffset = CANVAS_BROWSER_LAYOUT.previewWidth / 60;
    expect(Number.parseFloat(containerPreview.style.left)).toBeCloseTo(expectedOffset);
    expect(Number.parseFloat(containerPreview.style.top)).toBeCloseTo(expectedOffset);
    expect(containerPreview.style.zIndex).toBe("23");
    expect(containerPreview.style.borderColor).toBe("rgb(18, 52, 86)");
    expect(textPreview.style.zIndex).toBe("25");
    expect(textPreview.style.borderColor).toBe("rgb(171, 205, 239)");
    expect(imagePreview.style.zIndex).toBe("27");
    expect(imagePreview.style.borderColor).toBe("rgb(254, 220, 186)");
    expect(imagePreview.style.backgroundColor).toBe("transparent");
  });

  it("updates the active preview from transient camera and element geometry", () => {
    const settled = canvas("canvas-a", {
      containers: [
        {
          id: "container-a",
          name: "Container",
          x: 10,
          y: 20,
          width: 100,
          height: 80,
          accent: "#123456",
        },
      ],
    });
    const props = canvasManagerProps([settled]);
    const { container, rerender } = render(<CanvasManager {...props} embedded />);
    const preview = container.querySelector(
      '[data-canvas-preview-container="container-a"]',
    ) as HTMLElement;
    const initialLeft = preview.style.left;
    const live = {
      ...settled,
      pan: { x: -120, y: -40 },
      containers: [{ ...settled.containers[0], x: 50, y: 60 }],
    };

    rerender(<CanvasManager {...canvasManagerProps([live])} embedded />);

    expect(preview.style.left).not.toBe(initialLeft);
    expect(Number.parseFloat(preview.style.left)).toBeCloseTo(
      (50 - 120) * (CANVAS_BROWSER_LAYOUT.previewWidth / 1200),
    );
  });

  it("preserves inline editor focus, constraints, save, Enter, and Escape behavior", async () => {
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    const user = userEvent.setup();
    const props = canvasManagerProps([canvas("canvas-a")]);
    render(<CanvasManager {...props} embedded />);

    await user.click(screen.getByRole("button", { name: "Canvas menu" }));
    await user.click(screen.getByRole("button", { name: "Edit" }));
    const name = screen.getByRole("textbox", { name: "Name" });
    const width = screen.getByRole("spinbutton", { name: "Width" });
    const height = screen.getByRole("spinbutton", { name: "Height" });
    expect(name).toHaveFocus();
    expect(width).toHaveAttribute("min", "600");
    expect(width).toHaveAttribute("max", "10000");
    expect(width).toHaveAttribute("step", "100");

    fireEvent.change(name, { target: { value: "  Renamed  " } });
    fireEvent.change(width, { target: { value: "200" } });
    fireEvent.change(height, { target: { value: "12000" } });
    fireEvent.keyDown(width, { key: "Enter" });
    expect(props.onUpdateCanvas).toHaveBeenCalledWith("canvas-a", {
      name: "Renamed",
      width: 600,
      height: 10000,
    });

    await user.click(screen.getByRole("button", { name: "Canvas menu" }));
    await user.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Name" }), { key: "Escape" });
    expect(screen.queryByRole("textbox", { name: "Name" })).toBeNull();
    expect(props.onUpdateCanvas).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Canvas menu" }));
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("textbox", { name: "Name" })).toBeNull();
    expect(props.onUpdateCanvas).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Canvas menu" }));
    await user.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), {
      target: { value: "Button save" },
    });
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(props.onUpdateCanvas).toHaveBeenLastCalledWith("canvas-a", {
      name: "Button save",
      width: 3000,
      height: 3000,
    });
  });

  it("keeps the IconButton menu trigger from selecting its card", async () => {
    const user = userEvent.setup();
    const props = canvasManagerProps([canvas("canvas-a")]);
    const { container } = render(<CanvasManager {...props} embedded />);
    const trigger = screen.getByRole("button", { name: "Canvas menu" });

    expect(trigger).toHaveAttribute("data-canvas-menu-trigger");
    expect(trigger).toHaveAttribute("title", "Canvas menu");
    await user.click(trigger);
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(props.onSelectCanvas).not.toHaveBeenCalled();
    expect(container.querySelector('[data-canvas-card-id="canvas-a"]')).toBeInTheDocument();
  });

  it("preserves real create, select, context-menu, and delete callbacks", async () => {
    const user = userEvent.setup();
    const fixtures = [canvas("canvas-a"), canvas("canvas-b")];
    const props = canvasManagerProps(fixtures);
    render(<CanvasManager {...props} embedded />);

    await user.click(screen.getByText("Canvas B"));
    expect(props.onSelectCanvas).toHaveBeenCalledWith("canvas-b");

    await user.click(screen.getByRole("button", { name: "Create canvas" }));
    const name = screen.getByPlaceholderText("Canvas name");
    await user.clear(name);
    await user.type(name, "Production canvas");
    await user.click(screen.getByRole("button", { name: "Create" }));
    expect(props.onCreateCanvas).toHaveBeenCalledWith({
      name: "Production canvas",
      width: 3000,
      height: 3000,
    });

    fireEvent.click(document.querySelectorAll<HTMLButtonElement>("[data-canvas-menu-trigger]")[1]!);
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(props.onDeleteCanvas).toHaveBeenCalledWith("canvas-b");
  });

  it("consumes viewport and nested-card wheel input before it reaches the canvas route", () => {
    const canvasWheel = vi.fn();
    const fixtures = Array.from({ length: 8 }, (_, index) => canvas(`canvas-${index}`));
    const { container } = render(
      <div onWheel={canvasWheel}>
        <CanvasManager {...canvasManagerProps(fixtures)} embedded />
      </div>,
    );
    const viewport = container.querySelector("[data-canvas-browser-viewport]") as HTMLElement;

    const event = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      deltaY: 100,
      deltaMode: WheelEvent.DOM_DELTA_PIXEL,
    });
    fireEvent(viewport, event);

    const nestedTitle = container.querySelector(
      '[data-canvas-card-id="canvas-1"] .taskmap-canvas-browser-card__title',
    ) as HTMLElement;
    const nestedEvent = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      deltaY: 100,
      deltaMode: WheelEvent.DOM_DELTA_PIXEL,
    });
    fireEvent(nestedTitle, nestedEvent);

    expect(canvasWheel).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
    expect(nestedEvent.defaultPrevented).toBe(true);
  });

  it("reparents the same live Small card without a clone, duplicate, or placeholder", () => {
    const interactionFrames: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      interactionFrames.push(callback);
      return interactionFrames.length;
    });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
      this: HTMLElement,
    ) {
      if (this.dataset.canvasBrowserViewport !== undefined) return rect(74, 300, 288);
      if (this.dataset.canvasCardId) return rect(74, 84, 264);
      return rect(16, 370, 288);
    });
    const registry = createMaterialSurfaceRegistry(null);
    const { container } = renderProduction([canvas("canvas-a"), canvas("canvas-b")], registry);
    const card = container.querySelector('[data-canvas-card-id="canvas-a"]') as HTMLElement;
    const originalCard = card;
    const settledHost = card.parentElement;
    const settledOwner = settledHost?.parentElement;
    const cloneNode = vi.spyOn(Node.prototype, "cloneNode");

    expect(readNativeGlassDiagnostics(container)).toMatchObject({
      nativeBackdropFilterLayerCount: 4,
      temporaryDragBatchActive: false,
    });

    fireEvent(card, canvasPointerEvent("pointerdown", 7, 90));
    fireEvent(document, canvasPointerEvent("pointermove", 7, 96));
    act(() => {
      interactionFrames.shift()?.(16);
    });

    expect(card.style.opacity).toBe("");
    expect(card).toBe(originalCard);
    expect(card.parentElement).toBe(settledHost);
    expect(settledHost?.parentElement).not.toBe(settledOwner);
    expect(settledHost?.parentElement).toHaveAttribute("data-canvas-browser-drag-layer");
    expect(card).toHaveAttribute("data-material", "acrylic-small");
    expect(card).not.toHaveAttribute("data-material-motion");
    expect(card).toHaveAttribute("data-material-sampling-boundary", "inherited");
    expect(card.querySelector(".taskmap-material-native-glass__preblur")).toHaveAttribute(
      "data-enabled",
      "true",
    );
    expect(card.style.getPropertyValue("--taskmap-material-overscan-top")).toBe("");
    expect(container.querySelectorAll('[data-shared-small-glass-plane="active"]')).toHaveLength(2);
    expect(readNativeGlassDiagnostics(container)).toMatchObject({
      nativeBackdropFilterLayerCount: 6,
      localMaterialBackdropFilterCount: 1,
      sharedSmallBatchCount: 2,
      temporaryDragBatchActive: true,
    });
    expect(cloneNode).not.toHaveBeenCalled();
    expect(document.querySelector("[data-canvas-card-placeholder]")).toBeNull();
    expect(document.querySelectorAll('[data-canvas-card-id="canvas-a"]')).toHaveLength(1);

    fireEvent(document, canvasPointerEvent("pointerup", 7, 96));
    act(() => interactionFrames.shift()?.(32));
    act(() => interactionFrames.shift()?.(222));

    expect(card).toBe(originalCard);
    expect(card.parentElement).toBe(settledHost);
    expect(settledHost?.parentElement).toBe(settledOwner);
    expect(card).not.toHaveAttribute("data-material-motion");
    expect(card).toHaveAttribute("data-material-sampling-boundary", "inherited");
    expect(readNativeGlassDiagnostics(container)).toMatchObject({
      nativeBackdropFilterLayerCount: 4,
      temporaryDragBatchActive: false,
    });
    expect(registry.getSnapshot().surfaces).toEqual([]);
    expect(document.querySelector("[data-canvas-browser-drag-layer]")).toBeNull();
    registry.dispose();
  });

  it("keeps click selection below threshold and commits one order after the final snap", () => {
    const registry = createMaterialSurfaceRegistry(null);
    const notifySurfaceGeometryChanged = vi.fn();
    const interactionFrames: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      interactionFrames.push(callback);
      return interactionFrames.length;
    });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
      this: HTMLElement,
    ) {
      if (this.dataset.canvasBrowserViewport !== undefined) return rect(74, 300, 288);
      if (this.dataset.canvasCardId === "canvas-a") return rect(74, 84, 264);
      if (this.dataset.canvasCardId === "canvas-b") return rect(168, 84, 264);
      return rect(16, 370, 288);
    });
    const onReorderCanvases = vi.fn();
    const onSelectCanvas = vi.fn();

    function ReorderHarness() {
      const [ordered, setOrdered] = useState([canvas("canvas-a"), canvas("canvas-b")]);
      return (
        <MaterialSurfaceRegistrationProvider value={{ registry, notifySurfaceGeometryChanged }}>
          <ReducedMotionProvider override={false}>
            <CanvasManager
              {...canvasManagerProps(ordered)}
              embedded
              onSelectCanvas={onSelectCanvas}
              onReorderCanvases={(ids) => {
                onReorderCanvases(ids);
                setOrdered(ids.map((id) => ordered.find((item) => item.id === id)!));
              }}
            />
          </ReducedMotionProvider>
        </MaterialSurfaceRegistrationProvider>
      );
    }

    const { container } = render(<ReorderHarness />);
    notifySurfaceGeometryChanged.mockClear();
    const first = container.querySelector('[data-canvas-card-id="canvas-a"]') as HTMLElement;

    fireEvent(first, canvasPointerEvent("pointerdown", 8, 100));
    fireEvent(document, canvasPointerEvent("pointermove", 8, 105));
    act(() => interactionFrames.shift()?.(16));
    fireEvent(document, canvasPointerEvent("pointerup", 8, 105));
    act(() => interactionFrames.shift()?.(32));
    fireEvent.click(first);
    expect(onSelectCanvas).toHaveBeenCalledWith("canvas-a");
    expect(onReorderCanvases).not.toHaveBeenCalled();

    fireEvent(first, canvasPointerEvent("pointerdown", 9, 100));
    fireEvent(document, canvasPointerEvent("pointermove", 9, 300));
    act(() => interactionFrames.shift()?.(48));
    expect(onReorderCanvases).not.toHaveBeenCalled();
    fireEvent(document, canvasPointerEvent("pointerup", 9, 300));
    fireEvent.click(first);
    expect(onSelectCanvas).toHaveBeenCalledTimes(1);
    act(() => interactionFrames.shift()?.(64));
    act(() => interactionFrames.shift()?.(254));

    expect(onReorderCanvases).toHaveBeenCalledTimes(1);
    expect(onReorderCanvases).toHaveBeenCalledWith(["canvas-b", "canvas-a"]);
    expect(notifySurfaceGeometryChanged).not.toHaveBeenCalled();
    registry.dispose();
  });
});

function renderProduction(
  canvases: TaskCanvas[],
  registry: ReturnType<typeof createMaterialSurfaceRegistry>,
  overrides: Partial<ReturnType<typeof canvasManagerProps>> = {},
) {
  return render(
    <MaterialSurfaceRegistrationProvider
      value={{ registry, notifySurfaceGeometryChanged: vi.fn() }}
    >
      <ReducedMotionProvider override>
        <CanvasManager {...canvasManagerProps(canvases)} {...overrides} />
      </ReducedMotionProvider>
    </MaterialSurfaceRegistrationProvider>,
  );
}

function canvas(id: string, overrides: Partial<TaskCanvas> = {}): TaskCanvas {
  return {
    id,
    name: id === "canvas-a" ? "Canvas A" : "Canvas B",
    width: 3000,
    height: 3000,
    containers: [],
    textCards: [],
    textBlocks: [],
    images: [],
    mindmapConnections: [],
    pan: { x: 0, y: 0 },
    zoom: 1,
    ...overrides,
  };
}

function canvasManagerProps(canvases: TaskCanvas[]) {
  return {
    canvases,
    activeCanvasId: canvases[0]?.id ?? "",
    cardRadius: undefined as number | undefined,
    closing: false,
    minimalView: false,
    panelRadius: undefined as number | undefined,
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

function rect(top: number, height: number, width = 260): DOMRect {
  return {
    x: 0,
    y: top,
    left: 0,
    top,
    right: width,
    bottom: top + height,
    width,
    height,
    toJSON: () => ({}),
  };
}

function canvasPointerEvent(type: string, pointerId: number, clientY: number) {
  const event = new Event(type, { bubbles: true, cancelable: true }) as PointerEvent;
  Object.defineProperties(event, {
    pointerId: { value: pointerId },
    button: { value: 0 },
    clientY: { value: clientY },
  });
  return event;
}
