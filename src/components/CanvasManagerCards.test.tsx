import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TaskCanvas } from "../types";
import { MaterialSurfaceRegistrationProvider } from "../ui/materials/MaterialSurfaceRegistration";
import { createMaterialSurfaceRegistry } from "../ui/materials/materialSurfaceRegistry";
import { MotionProvider } from "../ui/motion/MotionProvider";
import {
  createMotionFrameScheduler,
  type MotionFrameDriver,
} from "../ui/motion/motionFrameScheduler";
import { ReducedMotionProvider } from "../ui/motion/reducedMotionPreference";
import { prepareCanvasBrowserDragPreview } from "../ui/patterns/workspace";
import { CanvasManager } from "./CanvasManager";

const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  if (originalScrollIntoView) HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
});

describe("C2D Canvas Browser cards", () => {
  it("maps full production cards to Acrylic Small and previews to unregistered Cutout", () => {
    const registry = createMaterialSurfaceRegistry(null);
    const { container } = renderProduction([canvas("canvas-a")], registry);
    const card = container.querySelector('[data-canvas-card-id="canvas-a"]');
    const preview = card?.querySelector('[data-material="cutout"]');

    expect(card).toHaveAttribute("data-material", "acrylic-small");
    expect(card).toHaveAttribute("data-canvas-card-mode", "full");
    expect((card as HTMLElement).style.getPropertyValue("--taskmap-material-radius")).toBe("12px");
    expect(preview).toHaveAttribute("data-material", "cutout");
    expect((preview as HTMLElement).style.getPropertyValue("--taskmap-material-radius")).toBe(
      "6px",
    );
    expect(
      registry
        .getSnapshot()
        .surfaces.map((surface) => surface.material)
        .sort(),
    ).toEqual(["acrylic-large", "acrylic-small"]);
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

    expect(containerPreview.style.left).toBe("1.6px");
    expect(containerPreview.style.top).toBe("1.6px");
    expect(containerPreview.style.zIndex).toBe("23");
    expect(containerPreview.style.borderColor).toBe("rgb(18, 52, 86)");
    expect(textPreview.style.zIndex).toBe("25");
    expect(textPreview.style.borderColor).toBe("rgb(171, 205, 239)");
    expect(imagePreview.style.zIndex).toBe("27");
    expect(imagePreview.style.borderColor).toBe("rgb(254, 220, 186)");
    expect(imagePreview.style.backgroundColor).toBe("transparent");
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

  it("hides and restores the registered drag-source mask and uses an opaque clone", async () => {
    const user = userEvent.setup();
    const registry = createMaterialSurfaceRegistry(null);
    const { container } = renderProduction([canvas("canvas-a")], registry);
    const card = container.querySelector('[data-canvas-card-id="canvas-a"]') as HTMLElement;

    await user.pointer({ keys: "[MouseLeft>]", target: card, coords: { clientY: 10 } });
    expect(card.style.opacity).toBe("0");
    expect(
      registry.getSnapshot().surfaces.find((surface) => surface.element === card)?.maskOpacity,
    ).toBe(0);
    const clone = document.body.querySelector(
      ".taskmap-canvas-browser-card--drag-preview",
    ) as HTMLElement;
    expect(clone).toHaveClass("taskmap-target-theme");
    expect(clone).not.toHaveAttribute("data-material");
    expect(clone).toHaveAttribute("data-material-strategy", "opaque");
    expect(clone).not.toHaveAttribute("data-material-surface-id");
    expect(registry.getSnapshot().surfaces.some((surface) => surface.element === clone)).toBe(
      false,
    );

    await user.pointer({ keys: "[/MouseLeft]", target: card, coords: { clientY: 10 } });
    expect(card.style.opacity).toBe("");
    expect(
      registry.getSnapshot().surfaces.find((surface) => surface.element === card)?.maskOpacity,
    ).toBe(1);
    expect(document.body.querySelector(".taskmap-canvas-browser-card--drag-preview")).toBeNull();
    registry.dispose();
  });

  it("strips cloned FLIP presentation before positioning the body-owned drag preview", () => {
    const clone = document.createElement("div");
    clone.dataset.material = "acrylic-small";
    clone.dataset.materialStrategy = "cached-acrylic";
    clone.dataset.materialSurfaceId = "surface-id";
    clone.style.transform = "translate3d(18px, -4px, 0) scale(0.98)";
    clone.style.transformOrigin = "top left";
    clone.style.willChange = "transform";

    prepareCanvasBrowserDragPreview(clone);

    expect(clone.style.transform).toBe("");
    expect(clone.style.transformOrigin).toBe("");
    expect(clone.style.willChange).toBe("");
    expect(clone).toHaveClass("taskmap-target-theme");
    expect(clone).not.toHaveAttribute("data-material");
    expect(clone).toHaveAttribute("data-material-strategy", "opaque");
    expect(clone).not.toHaveAttribute("data-material-surface-id");
    expect(clone.style.getPropertyValue("--taskmap-material-tint-opacity")).toBe("1");
  });

  it("preserves drag reorder thresholds while shared FLIP motion performs cheap geometry work", async () => {
    const user = userEvent.setup();
    const frameDriver = new ControlledFrameDriver();
    const scheduler = createMotionFrameScheduler(frameDriver);
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
      const cardId = this.dataset.canvasCardId;
      if (cardId && this.parentElement) {
        const cards = [...this.parentElement.querySelectorAll("[data-canvas-card-id]")];
        const index = cards.indexOf(this);
        return rect(index * 100, 84);
      }
      return rect(0, 500, 290);
    });
    const onReorderCanvases = vi.fn();

    function ReorderHarness() {
      const [ordered, setOrdered] = useState([canvas("canvas-a"), canvas("canvas-b")]);
      return (
        <MaterialSurfaceRegistrationProvider value={{ registry, notifySurfaceGeometryChanged }}>
          <ReducedMotionProvider override={false}>
            <MotionProvider scheduler={scheduler}>
              <CanvasManager
                {...canvasManagerProps(ordered)}
                onReorderCanvases={(ids) => {
                  onReorderCanvases(ids);
                  setOrdered(ids.map((id) => ordered.find((item) => item.id === id)!));
                }}
              />
            </MotionProvider>
          </ReducedMotionProvider>
        </MaterialSurfaceRegistrationProvider>
      );
    }

    const { container } = render(<ReorderHarness />);
    act(() => frameDriver.flush());
    notifySurfaceGeometryChanged.mockClear();
    const first = container.querySelector('[data-canvas-card-id="canvas-a"]') as HTMLElement;
    await user.pointer([
      { keys: "[MouseLeft>]", target: first, coords: { clientY: 10 } },
      { target: first, coords: { clientY: 160 } },
    ]);
    act(() => interactionFrames.shift()?.(16));

    expect(onReorderCanvases).toHaveBeenCalledWith(["canvas-b", "canvas-a"]);
    expect(scheduler.getSnapshot().subscriberCount).toBeGreaterThan(0);
    expect(notifySurfaceGeometryChanged).toHaveBeenCalled();
    act(() => frameDriver.flush());
    const callsAtSettlement = notifySurfaceGeometryChanged.mock.calls.length;
    expect(scheduler.getSnapshot()).toEqual({ subscriberCount: 0, framePending: false });
    expect(frameDriver.fire()).toBe(false);
    expect(notifySurfaceGeometryChanged).toHaveBeenCalledTimes(callsAtSettlement);

    await user.pointer({ keys: "[/MouseLeft]", target: first, coords: { clientY: 160 } });
    scheduler.dispose();
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

class ControlledFrameDriver implements MotionFrameDriver {
  private callbacks = new Map<number, (timestampMs: number) => void>();
  private nextHandle = 1;
  private timestampMs = 0;

  request(callback: (timestampMs: number) => void): number {
    const handle = this.nextHandle++;
    this.callbacks.set(handle, callback);
    return handle;
  }

  cancel(handle: number): void {
    this.callbacks.delete(handle);
  }

  fire(): boolean {
    const entry = this.callbacks.entries().next().value as
      [number, (timestampMs: number) => void] | undefined;
    if (!entry) return false;
    this.callbacks.delete(entry[0]);
    this.timestampMs += 1000 / 60;
    entry[1](this.timestampMs);
    return true;
  }

  flush(limit = 60): void {
    for (let frame = 0; frame < limit && this.fire(); frame += 1) {
      // Shared motion queues at most one next frame while work remains active.
    }
  }
}
