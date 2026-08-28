import { cleanup, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithUiProviders as render } from "../test/renderWithUiProviders";
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

  it("updates only the local inspection Surface while preserving its DOM owner", async () => {
    const user = userEvent.setup();
    const { container } = render(<SurfaceMaterialPrototype />);
    const interactive = container.querySelector<HTMLElement>("[data-prototype-interactive]")!;

    await user.click(screen.getByRole("combobox", { name: "Prototype material" }));
    await user.click(screen.getByRole("option", { name: "Minor glass" }));
    fireEvent.keyDown(screen.getByRole("slider", { name: "Prototype width" }), { key: "End" });
    fireEvent.keyDown(screen.getByRole("slider", { name: "Prototype height" }), { key: "End" });
    fireEvent.keyDown(screen.getByRole("slider", { name: "Prototype corner radius" }), {
      key: "End",
    });

    const updated = container.querySelector<HTMLElement>("[data-prototype-interactive]")!;
    expect(updated).toBe(interactive);
    expect(updated).toHaveAttribute("data-material", "acrylic-small");
    expect(updated).toHaveStyle({ width: "300px", height: "160px", borderRadius: "32px" });
    expect(screen.getByText("300 × 160 · 32px")).toBeInTheDocument();
  });
});

function sample(container: HTMLElement, name: string): HTMLElement {
  return container.querySelector<HTMLElement>(`[data-prototype-sample='${name}']`)!;
}
