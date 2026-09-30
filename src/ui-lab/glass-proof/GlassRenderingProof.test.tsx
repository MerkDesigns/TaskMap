import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GlassRenderingProof } from "./GlassRenderingProof";
import { readSmallOutputShapes } from "../../ui/materials/sharedSmallOutputMask";

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
  // Count batched shapes independently of the output-mask or legacy clip renderer.
  const rectangles = () =>
    [...container.querySelectorAll<HTMLElement>("[data-shared-small-glass-plane]")].flatMap(
      (plane) => readSmallOutputShapes(plane),
    );
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

it("keeps the local baseline selectable and uses one candidate Major plane without local Major filters", () => {
  const { container } = render(<GlassRenderingProof />);
  fireEvent.change(screen.getByRole("combobox", { name: "Backend" }), {
    target: { value: "stable" },
  });
  const majorPlane = container.querySelector('[data-stable-glass-depth="major-base"]')!;
  expect(container.querySelectorAll('[data-stable-glass-depth="major-base"]')).toHaveLength(1);
  expect(majorPlane).toHaveAttribute("data-plane-shape-count", "2");
  const originalUpper = container.querySelector('[data-proof-surface="minor-upper"]');
  fireEvent.click(screen.getByLabelText("Third Major"));
  expect(majorPlane).toHaveAttribute("data-plane-shape-count", "3");
  expect(originalUpper?.querySelectorAll("clipPath")).toHaveLength(2);
  fireEvent.click(screen.getByLabelText("Third Major"));
  expect(majorPlane).toHaveAttribute("data-plane-shape-count", "2");
  expect(container.querySelector('[data-proof-surface="minor-upper"]')).toBe(originalUpper);
  expect(originalUpper?.querySelectorAll("clipPath")).toHaveLength(1);
  for (const name of ["major-a", "major-b"]) {
    expect(
      container.querySelector(`[data-proof-surface="${name}"] .taskmap-native-glass-backdrop`),
    ).toBeNull();
  }
  fireEvent.click(screen.getByLabelText("Separate Majors"));
  fireEvent.click(screen.getByLabelText("Major A ink"));
  fireEvent.click(screen.getByRole("button", { name: "Red far away" }));
  expect(container.querySelector('[data-stable-glass-depth="major-base"]')).toBe(majorPlane);
  const majorB = container.querySelector('[data-proof-surface="major-b"]')!;
  expect(majorB).toHaveStyle({ left: "660px", width: "310px", height: "120px" });
  fireEvent.click(screen.getByLabelText("Expand Major B"));
  expect(container.querySelector('[data-proof-surface="major-b"]')).toBe(majorB);
  expect(majorB).toHaveStyle({ width: "390px", height: "240px" });
  expect(container.querySelector('[data-stable-glass-depth="major-base"]')).toBe(majorPlane);
  expect(container.querySelector(".taskmap-glass-proof__red")).toHaveAttribute(
    "data-proof-red-x",
    "950",
  );
  fireEvent.click(screen.getByLabelText("Promote Minor"));
  expect(container.querySelector('[data-stable-glass-depth="minor-promoted"]')).not.toBeNull();
  const upper = container.querySelector('[data-proof-surface="minor-upper"]');
  expect(upper).toHaveStyle({ left: "220px", top: "210px" });
  fireEvent.click(screen.getByLabelText("Promote in place"));
  expect(container.querySelector('[data-proof-surface="minor-upper"]')).toBe(upper);
  expect(upper).toHaveStyle({ left: "380px", top: "185px" });
  fireEvent.change(screen.getByRole("combobox", { name: "Backend" }), {
    target: { value: "local" },
  });
  expect(container.querySelector("[data-stable-glass-depth]")).toBeNull();
  expect(
    container.querySelector('[data-proof-surface="major-a"] .taskmap-native-glass-backdrop'),
  ).not.toBeNull();
  expect(container.querySelector('[data-proof-surface="minor-upper"]')).toHaveStyle({
    left: "290px",
    top: "130px",
  });
  expect(container.querySelector('[data-proof-surface="major-b"]')).toHaveStyle({
    left: "660px",
    width: "390px",
    height: "240px",
  });
  fireEvent.click(screen.getByRole("button", { name: "Reset proof" }));
  expect(screen.getByLabelText("Expand Major B")).not.toBeChecked();
  expect(screen.getByLabelText("Promote in place")).not.toBeChecked();
  expect(container.querySelector('[data-proof-surface="major-b"]')).toHaveStyle({ left: "380px" });
});

it("moves backdrop pixels without measuring geometry or changing candidate filter nodes/masks", () => {
  const { container } = render(<GlassRenderingProof />);
  fireEvent.change(screen.getByRole("combobox", { name: "Backend" }), {
    target: { value: "stable" },
  });
  fireEvent.click(screen.getByLabelText("Move red"));
  fireEvent.click(screen.getByLabelText("Animate media"));
  const planes = [...container.querySelectorAll("[data-stable-glass-depth]")];
  const styles = planes.map((plane) => plane.getAttribute("style"));
  const filters = planes.flatMap((plane) => [...plane.children]);
  const measure = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect");
  const calls = vi.mocked(requestAnimationFrame).mock.calls;
  const draw = calls[calls.length - 1][0];
  draw(performance.now() + 1000);
  draw(performance.now() + 2000);
  expect(measure).not.toHaveBeenCalled();
  expect(planes.map((plane) => plane.getAttribute("style"))).toEqual(styles);
  expect(planes.flatMap((plane) => [...plane.children])).toEqual(filters);
});
