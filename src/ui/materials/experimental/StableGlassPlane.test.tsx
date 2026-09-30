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

it("occludes foreground in scene coordinates without masking a filter ancestor or replacing content", () => {
  const upper = { ...shape, x: 180, y: 40, radius: 14 };
  const renderSurface = (x: number) => (
    <StableGlassSurface
      depth="major-base"
      shape={shape}
      name="lower"
      occlusion={{
        width: 1100,
        height: 425,
        shapes: [
          { ...upper, x },
          { ...upper, x: 200 },
        ],
      }}
    >
      <button>Still interactive outside the overlap</button>
    </StableGlassSurface>
  );
  const { container, rerender } = render(renderSurface(180));
  const surface = container.firstElementChild as HTMLElement;
  const button = surface.querySelector("button");
  const clip = () => surface.querySelector("clipPath path")!.getAttribute("d")!;
  expect(clip()).toContain("M-20 -30h1100v425h-1100Z");
  expect(clip()).toContain("M174 10H346A14 14");
  const clips = surface.querySelectorAll("clipPath");
  expect(clips).toHaveLength(2);
  expect(clips[1].firstElementChild).toHaveAttribute("clip-path", `url(#${clips[0].id})`);
  expect(surface.style.clipPath).toBe(`url(#${clips[1].id})`);
  expect(surface.querySelector(".taskmap-native-glass-backdrop")).toBeNull();
  vi.mocked(drawNativeGlassRim).mockClear();
  rerender(renderSurface(500));
  expect(container.firstElementChild).toBe(surface);
  expect(surface.querySelector("button")).toBe(button);
  expect(clip()).toContain("M494 10");
  expect(drawNativeGlassRim).not.toHaveBeenCalled();
});

it("subtracts upper siblings from Minor filter output without clipping the filter parent", () => {
  const { container } = render(
    <StableGlassPlane
      depth="minor-settled"
      width={1100}
      height={425}
      shapes={[shape]}
      occluders={[{ ...shape, x: 180 }]}
    />,
  );
  const plane = container.firstElementChild as HTMLElement;
  expect(plane.style.maskImage).toBe("");
  expect(decodeURIComponent(plane.style.getPropertyValue("--taskmap-plane-mask"))).toContain(
    'mask="url(#visible)"',
  );
  expect(plane.children).toHaveLength(2);
});
