import { cleanup, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { UiLabApp } from "./UiLabApp";

class TestResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeAll(() => vi.stubGlobal("ResizeObserver", TestResizeObserver));

afterAll(() => vi.unstubAllGlobals());

afterEach(cleanup);

describe("UiLabApp", () => {
  it("renders the isolated current-material baseline through MaterialSurface", () => {
    const { container } = render(<UiLabApp />);

    expect(
      screen.getByText("Current material baseline — architecture not migrated"),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Current Major baseline" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Current Minor baseline" })).toBeInTheDocument();
    const baseline = container.querySelector<HTMLElement>(".taskmap-ui-lab__major");
    expect(baseline).not.toBeNull();
    expect(materials(baseline!)).toEqual(["acrylic-large", "acrylic-small", "opaque", "cutout"]);
    expect(
      screen.getByRole("heading", { name: "Surface + Material prototype" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Composable presence behaviors" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Production TextBlock beneath glass" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Interactive controls prototype" }),
    ).toBeInTheDocument();
    expect(container.querySelector("[data-ui-lab-scroll-viewport]")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Window controls" })).toBeInTheDocument();
  });

  it("uses the shared production theme, canvas background, and ordinary controls", () => {
    const { container } = render(<UiLabApp />);

    expect(container.querySelector("[data-taskmap-ui-lab='isolated-baseline']")).toHaveClass(
      "taskmap-target-theme",
      "taskmap-workspace-root",
    );
    expect(container.querySelector("[data-grid-style='dots']")).toHaveClass("taskmap-canvas-frame");
    expect(screen.getByRole("button", { name: "Sample action" })).toHaveClass("taskmap-button");
    expect(screen.getByRole("textbox", { name: "Baseline text field" })).toHaveValue(
      "Visual context",
    );
  });
});

function materials(container: HTMLElement): string[] {
  const descendants = [...container.querySelectorAll<HTMLElement>(".taskmap-material-surface")];
  const surfaces = container.matches(".taskmap-material-surface")
    ? [container, ...descendants]
    : descendants;
  return surfaces.map((surface) => surface.dataset.material ?? "");
}
