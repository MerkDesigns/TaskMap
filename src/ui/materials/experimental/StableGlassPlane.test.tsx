import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { StableGlassPlane, StableGlassSurface } from "./StableGlassPlane";
import { drawNativeGlassRim } from "../nativeGlassRim";
vi.mock("../nativeGlassRim", () => ({ drawNativeGlassRim: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const shape = { x: 20, y: 30, width: 200, height: 100, radius: 20 };

it("shares one fixed plane across shapes and retains filter nodes when shape geometry changes", () => {
  const { container, rerender } = render(
    <StableGlassPlane
      depth="major-base"
      width={1100}
      height={425}
      shapes={[shape, { ...shape, x: 300 }]}
    />,
  );
  const plane = container.firstElementChild!;
  const filters = [...plane.children];
  const originalMask = (plane as HTMLElement).style.getPropertyValue("--taskmap-plane-mask");
  expect(plane).toHaveAttribute("data-plane-shape-count", "2");
  expect(filters).toHaveLength(2);
  rerender(
    <StableGlassPlane
      depth="major-base"
      width={1100}
      height={425}
      shapes={[{ ...shape, x: 400, radius: 14 }]}
    />,
  );
  expect(container.firstElementChild).toBe(plane);
  expect([...plane.children]).toEqual(filters);
  expect(plane).toHaveStyle({
    width: "1100px",
    height: "425px",
    "--taskmap-material-blur": "60px",
    "--taskmap-material-preblur": "6px",
  });
  expect((plane as HTMLElement).style.getPropertyValue("--taskmap-plane-mask")).not.toBe(
    originalMask,
  );
});

it("keeps foreground and rim outside the masked plane; pure translation does not redraw the rim", () => {
  const { container, rerender } = render(
    <StableGlassSurface depth="major-base" shape={shape} name="test">
      Foreground
    </StableGlassSurface>,
  );
  const shell = container.firstElementChild!;
  expect(shell.querySelector(".taskmap-native-glass-backdrop")).toBeNull();
  expect(shell.querySelector(".taskmap-native-glass-preblur")).toBeNull();
  expect(shell.querySelector("canvas")).not.toBeNull();
  vi.mocked(drawNativeGlassRim).mockClear();
  rerender(
    <StableGlassSurface depth="major-base" shape={{ ...shape, x: 90 }} name="test">
      Foreground
    </StableGlassSurface>,
  );
  expect(container.firstElementChild).toBe(shell);
  expect(drawNativeGlassRim).not.toHaveBeenCalled();
});

it("promotes Small at a higher depth while preserving its optical recipe", () => {
  const { container, rerender } = render(
    <StableGlassPlane depth="minor-settled" width={1100} height={425} shapes={[shape]} />,
  );
  const plane = container.firstElementChild! as HTMLElement;
  const blur = plane.style.getPropertyValue("--taskmap-material-blur");
  const preblur = plane.style.getPropertyValue("--taskmap-material-preblur");
  const settledDepth = Number(plane.style.zIndex);
  rerender(<StableGlassPlane depth="minor-promoted" width={1100} height={425} shapes={[shape]} />);
  expect(Number(plane.style.zIndex)).toBeGreaterThan(settledDepth);
  expect(plane.style.getPropertyValue("--taskmap-material-blur")).toBe(blur);
  expect(plane.style.getPropertyValue("--taskmap-material-preblur")).toBe(preblur);
});
