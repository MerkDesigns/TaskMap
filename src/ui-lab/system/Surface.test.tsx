import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import type { SurfaceMaterial } from "./Material";
import { Surface, type SurfaceProps } from "./Surface";

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Surface", () => {
  it("renders an ordinary rectangle without material layers or imposed geometry", () => {
    const { container } = render(<Surface>Plain content</Surface>);
    const surface = screen.getByText("Plain content");

    expect(surface.tagName).toBe("DIV");
    expect(container.childElementCount).toBe(1);
    expect(surface).not.toHaveAttribute("data-material");
    expect(surface.querySelector(".taskmap-material-native-glass__clip")).toBeNull();
    expect(surface).not.toHaveAttribute("style");
  });

  it("forwards standard class, style, children, events, and ref behavior", () => {
    const ref = createRef<HTMLElement>();
    const onClick = vi.fn();
    const view = (label: string) => (
      <Surface
        ref={ref}
        aria-label="Ordinary Surface"
        className="feature-surface"
        onClick={onClick}
        style={{ width: 180, height: 90 }}
      >
        <span>{label}</span>
      </Surface>
    );
    const { rerender } = render(view("First"));
    const surface = screen.getByLabelText("Ordinary Surface");

    expect(ref.current).toBe(surface);
    expect(surface).toHaveClass("taskmap-ui-lab-surface", "feature-surface");
    expect(surface).toHaveStyle({ width: "180px", height: "90px" });
    expect(screen.getByText("First").parentElement).toBe(surface);
    fireEvent.click(surface);
    expect(onClick).toHaveBeenCalledOnce();

    rerender(view("Updated"));
    expect(screen.getByLabelText("Ordinary Surface")).toBe(surface);
    expect(screen.getByText("Updated").parentElement).toBe(surface);
  });

  it("accepts zero or one typed material and keeps one outer rectangle", () => {
    expectTypeOf<SurfaceProps["material"]>().toEqualTypeOf<SurfaceMaterial | undefined>();

    const { container, rerender } = render(
      <Surface material="major-glass" radius={17} style={{ width: 210, height: 95 }}>
        Material content
      </Surface>,
    );
    const surface = container.firstElementChild as HTMLElement;

    expect(container.childElementCount).toBe(1);
    expect(surface).toHaveAttribute("data-material", "acrylic-large");
    expect(surface).toHaveStyle({ width: "210px", height: "95px", borderRadius: "17px" });

    rerender(
      <Surface material="minor-glass" radius={17} style={{ width: 210, height: 95 }}>
        Material content
      </Surface>,
    );
    expect(container.firstElementChild).toBe(surface);
    expect(surface).toHaveAttribute("data-material", "acrylic-small");
  });

  it.each([
    ["major-glass", "acrylic-large"],
    ["minor-glass", "acrylic-small"],
    ["opaque", "opaque"],
    ["cutout", "cutout"],
  ] as const)("renders %s through MaterialSurface as %s", (material, currentMaterial) => {
    const { container } = render(
      <Surface material={material} radius={0}>
        Sample
      </Surface>,
    );
    const surface = container.firstElementChild as HTMLElement;

    expect(surface).toHaveClass("taskmap-material-surface", "taskmap-ui-lab-surface");
    expect(surface).toHaveAttribute("data-material", currentMaterial);
    expect(container.querySelectorAll(":scope > .taskmap-material-surface")).toHaveLength(1);
  });
});
