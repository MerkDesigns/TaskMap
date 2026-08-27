import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { DraggableTextBlockFixture } from "./DraggableTextBlockFixture";

class TestResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

class TestPointerEvent extends MouseEvent {
  readonly pointerId: number;

  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 0;
  }
}

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", TestResizeObserver);
  vi.stubGlobal("PointerEvent", TestPointerEvent);
});

afterAll(() => vi.unstubAllGlobals());

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("DraggableTextBlockFixture", () => {
  it("renders the real production TextBlockNode beneath Major and nested Minor glass", () => {
    const { container } = render(<DraggableTextBlockFixture />);
    const nodeLayer = container.querySelector<HTMLElement>("[data-ui-lab-draggable-text-block]");
    const node = nodeLayer?.querySelector<HTMLElement>("article");
    const major = container.querySelector<HTMLElement>("[data-ui-lab-drag-material='major']");
    const minor = container.querySelector<HTMLElement>("[data-ui-lab-drag-material='minor']");

    expect(screen.getByText("Moving red production TextBlock")).toBeInTheDocument();
    expect(node?.querySelector("[data-text-block-content]")).toHaveTextContent(
      "Live backdrop sample",
    );
    expect(node).toHaveStyle({ backgroundColor: "#f01846", width: "340px", height: "230px" });
    expect(major).toHaveAttribute("data-material", "acrylic-large");
    expect(minor).toHaveAttribute("data-material", "acrylic-small");
    expect(major).toContainElement(minor);
    expect(nodeLayer).toHaveClass("taskmap-ui-lab-text-block__node-layer");
    expect(major).toHaveClass("taskmap-ui-lab-text-block__major");
  });

  it("uses pointer capture and updates position through one animation frame", () => {
    let scheduledFrame: FrameRequestCallback | undefined;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      scheduledFrame = callback;
      return 7;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
    const { container } = render(<DraggableTextBlockFixture />);
    const nodeLayer = container.querySelector<HTMLElement>("[data-ui-lab-draggable-text-block]")!;
    const handle = nodeLayer.querySelector<HTMLElement>(".cursor-grab")!;
    const setPointerCapture = vi.fn();
    Object.defineProperty(handle, "setPointerCapture", { value: setPointerCapture });

    fireEvent.pointerDown(handle, { button: 0, clientX: 80, clientY: 270, pointerId: 4 });
    fireEvent.pointerMove(handle, { clientX: 310, clientY: 360, pointerId: 4 });

    expect(setPointerCapture).toHaveBeenCalledWith(4);
    expect(scheduledFrame).toBeTypeOf("function");
    scheduledFrame?.(0);
    expect(nodeLayer).toHaveAttribute("data-drag-x", "278");
    expect(nodeLayer).toHaveAttribute("data-drag-y", "328");
    expect(nodeLayer.style.transform).toBe("translate3d(278px, 328px, 0)");
  });

  it("resets the locally dragged node without product state", () => {
    const { container } = render(<DraggableTextBlockFixture />);
    const nodeLayer = container.querySelector<HTMLElement>("[data-ui-lab-draggable-text-block]")!;
    nodeLayer.style.transform = "translate3d(500px, 100px, 0)";
    nodeLayer.dataset.dragX = "500";

    fireEvent.click(screen.getByRole("button", { name: "Reset node" }));

    expect(nodeLayer).toHaveAttribute("data-drag-x", "48");
    expect(nodeLayer).toHaveAttribute("data-drag-y", "238");
    expect(nodeLayer.style.transform).toBe("translate3d(48px, 238px, 0)");
  });
});
