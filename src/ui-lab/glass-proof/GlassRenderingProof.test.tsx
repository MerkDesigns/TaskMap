import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GlassRenderingProof } from "./GlassRenderingProof";

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  // Geometry/pixels are verified in WebView2, not simulated by this structural test.
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn(() => 1),
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    fillRect() {},
  } as unknown as ReturnType<HTMLCanvasElement["getContext"]>);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("promotes one card out of the shared batch and resets to two without replacing its identity", () => {
  const { container } = render(<GlassRenderingProof />);
  const upper = container.querySelector('[data-proof-surface="minor-upper"]')!;
  const rectangles = () => container.querySelectorAll("[data-shared-small-glass-clip] > rect");
  expect(rectangles()).toHaveLength(2);
  fireEvent.click(screen.getByLabelText("Promote Minor"));
  expect(rectangles()).toHaveLength(1);
  expect(container.querySelector('[data-proof-surface="minor-upper"]')).toBe(upper);
  expect(upper).toHaveAttribute("data-material-backdrop-source", "self");
  expect(upper).toHaveAttribute("data-material", "acrylic-small");
  expect(upper).toHaveStyle({ "--taskmap-material-radius": "14px" });
  fireEvent.click(screen.getByLabelText("Higher overlay"));
  fireEvent.click(screen.getByLabelText("Major A ink"));
  fireEvent.click(screen.getByRole("button", { name: "Red right" }));
  expect(container.querySelector('[data-proof-layer="2"]')).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Reset proof" }));
  expect(rectangles()).toHaveLength(2);
  expect(upper).toHaveAttribute("data-material-backdrop-source", "shared");
  expect(container.querySelector('[data-proof-layer="2"]')).not.toBeInTheDocument();
  expect(screen.getByLabelText("Major A ink")).not.toBeChecked();
  expect(container.querySelector(".taskmap-glass-proof__red")).toHaveAttribute(
    "data-proof-red-x",
    "0",
  );
});

it("schedules backdrop animation only while enabled and cancels it on view disposal", () => {
  const { unmount } = render(<GlassRenderingProof />);
  const request = vi.mocked(requestAnimationFrame);
  request.mockClear();
  fireEvent.click(screen.getByLabelText("Animate media"));
  expect(request).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByLabelText("Move red"));
  expect(screen.getByRole("button", { name: "Drag red ↔" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Red left" })).toBeDisabled();
  vi.mocked(cancelAnimationFrame).mockClear();
  unmount();
  expect(cancelAnimationFrame).toHaveBeenCalledWith(1);
});
