import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SurfaceMaterialPrototype } from "./SurfaceMaterialPrototype";

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("SurfaceMaterialPrototype", () => {
  it("shows the plain, aliased, and direct-reference samples", () => {
    const { container } = render(<SurfaceMaterialPrototype />);

    expect(screen.getByRole("heading", { name: "Surface + Material prototype" })).toBeVisible();
    expect(sample(container, "plain")).not.toHaveAttribute("data-material");
    expect(sample(container, "major-glass")).toHaveAttribute("data-material", "acrylic-large");
    expect(sample(container, "direct-acrylic-large")).toHaveAttribute(
      "data-material",
      "acrylic-large",
    );
    expect(sample(container, "minor-glass")).toHaveAttribute("data-material", "acrylic-small");
    expect(sample(container, "opaque")).toHaveAttribute("data-material", "opaque");
    expect(sample(container, "cutout")).toHaveAttribute("data-material", "cutout");
  });

  it("updates only the local inspection Surface while preserving its DOM owner", () => {
    const { container } = render(<SurfaceMaterialPrototype />);
    const interactive = container.querySelector<HTMLElement>("[data-prototype-interactive]")!;

    fireEvent.change(screen.getByRole("combobox", { name: "Prototype material" }), {
      target: { value: "minor-glass" },
    });
    fireEvent.change(screen.getByRole("slider", { name: "Prototype width" }), {
      target: { value: "284" },
    });
    fireEvent.change(screen.getByRole("slider", { name: "Prototype height" }), {
      target: { value: "146" },
    });
    fireEvent.change(screen.getByRole("slider", { name: "Prototype corner radius" }), {
      target: { value: "29" },
    });

    const updated = container.querySelector<HTMLElement>("[data-prototype-interactive]")!;
    expect(updated).toBe(interactive);
    expect(updated).toHaveAttribute("data-material", "acrylic-small");
    expect(updated).toHaveStyle({ width: "284px", height: "146px", borderRadius: "29px" });
    expect(screen.getByText("284 × 146 · 29px")).toBeInTheDocument();
  });
});

function sample(container: HTMLElement, name: string): HTMLElement {
  return container.querySelector<HTMLElement>(`[data-prototype-sample='${name}']`)!;
}
