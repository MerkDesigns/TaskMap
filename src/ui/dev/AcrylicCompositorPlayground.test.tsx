import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMaterialCompositorPresentationBridge } from "../materials/materialCompositorPresentation";
import { AcrylicCompositorPlayground } from "./AcrylicCompositorPlayground";
import { ACRYLIC_PLAYGROUND_SCENE } from "./acrylicPlaygroundModel";

beforeEach(() => {
  class TestPointerEvent extends MouseEvent {
    readonly pointerId: number;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
    }
  }
  vi.stubGlobal("PointerEvent", TestPointerEvent);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement,
  ) {
    return rectangle(this.classList.contains("taskmap-acrylic-playground__viewport") ? 100 : 0);
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("AcrylicCompositorPlayground", () => {
  it("publishes pan, zoom, and reset through the existing presentation boundary", () => {
    const presentation = createMaterialCompositorPresentationBridge();
    const { container } = render(<AcrylicCompositorPlayground presentation={presentation} />);
    const viewport = container.querySelector<HTMLElement>(".taskmap-acrylic-playground__viewport");
    if (!viewport) throw new Error("Missing playground viewport");
    const initial = presentation.getSnapshot();
    expect(initial?.buildScene({ x: 0, y: 0, width: 1, height: 1 }, 1)).toBe(
      ACRYLIC_PLAYGROUND_SCENE,
    );

    fireEvent.pointerDown(viewport, { pointerId: 1, button: 0, clientX: 300, clientY: 220 });
    fireEvent.pointerMove(viewport, { pointerId: 1, clientX: 340, clientY: 195 });
    expect(presentation.getSnapshot()?.viewport.pan).not.toEqual(initial?.viewport.pan);
    fireEvent.pointerUp(viewport, { pointerId: 1, clientX: 340, clientY: 195 });

    const beforeZoom = presentation.getSnapshot()?.viewport.zoom ?? 0;
    fireEvent.wheel(viewport, { clientX: 320, clientY: 210, deltaY: -120 });
    expect(presentation.getSnapshot()?.viewport.zoom).toBeGreaterThan(beforeZoom);
    fireEvent.click(screen.getByRole("button", { name: "Reset View" }));
    expect(screen.getByText(/Zoom \d+%/)).toHaveTextContent("Zoom 58%");
  });

  it("switches the real MaterialSurface among existing preset strategies", () => {
    const presentation = createMaterialCompositorPresentationBridge();
    const { container } = render(<AcrylicCompositorPlayground presentation={presentation} />);
    const surface = () =>
      container.querySelector<HTMLElement>(".taskmap-acrylic-playground__surface");

    expect(surface()).toHaveAttribute("data-material", "acrylic-large");
    fireEvent.change(screen.getByRole("combobox", { name: "Test surface" }), {
      target: { value: "compact-card" },
    });
    expect(surface()).toHaveAttribute("data-material", "acrylic-small");
    expect(surface()).toHaveStyle("--taskmap-material-radius: 7px");
    fireEvent.change(screen.getByRole("combobox", { name: "Test surface" }), {
      target: { value: "cutout" },
    });
    expect(surface()).toHaveAttribute("data-material", "cutout");
    expect(screen.getByText("Cutout does not blur.")).toBeVisible();
  });

  it("renders the visible geometry from the same primitive collection", () => {
    const presentation = createMaterialCompositorPresentationBridge();
    const { container } = render(<AcrylicCompositorPlayground presentation={presentation} />);
    expect(container.querySelectorAll(".taskmap-acrylic-playground__scene g > rect")).toHaveLength(
      ACRYLIC_PLAYGROUND_SCENE.primitives.length + 2,
    );
    expect(presentation.getSnapshot()?.buildScene({ x: 0, y: 0, width: 1, height: 1 }, 1)).toBe(
      ACRYLIC_PLAYGROUND_SCENE,
    );
  });

  it("anchors the real acrylic context-menu demo over the compositor-backed scene", () => {
    const presentation = createMaterialCompositorPresentationBridge();
    const { container } = render(<AcrylicCompositorPlayground presentation={presentation} />);
    const viewport = container.querySelector(".taskmap-acrylic-playground__viewport");
    const trigger = screen.getByRole("button", { name: "Open container context menu" });
    expect(viewport).toContainElement(trigger);
    fireEvent.click(trigger);
    const menu = screen.getByRole("menu", { name: "Container context menu example" });
    expect(viewport).toContainElement(menu);
    expect(menu).toHaveAttribute("data-material", "opaque");
    expect(menu).toHaveAttribute("data-material-strategy", "opaque");
    expect(presentation.getSnapshot()?.sceneKey).toBe("ui-lab-acrylic-playground");
  });
});

function rectangle(left: number): DOMRect {
  return {
    x: left,
    y: 80,
    left,
    top: 80,
    width: 680,
    height: 360,
    right: left + 680,
    bottom: 440,
    toJSON: () => ({}),
  } as DOMRect;
}
