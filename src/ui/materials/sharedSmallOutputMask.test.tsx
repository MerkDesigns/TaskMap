import { render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  SmallGlassOutputMaskEnabled,
  layeredOutputMask,
  registerSmallOutputMask,
  writeSmallOutputShapes,
} from "./sharedSmallOutputMask";
import { SharedSmallGlassPlane, writeSharedSmallGlassShapes } from "./SharedSmallGlassPlane";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const shape = {
  x: 12,
  y: -80,
  width: 264,
  height: 84,
  radius: 13.5,
  clip: { left: 12, top: 0, width: 264, height: 4 },
};

it("aligns overscanned output masks and updates scroll shapes without measuring geometry", () => {
  const frames = new Map<number, FrameRequestCallback>();
  let id = 0;
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => {
    frames.set(++id, fn);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (key: number) => frames.delete(key));
  const flush = () => {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((fn) => fn(0));
  };
  const plane = document.createElement("div");
  plane.style.cssText = "width:288px;height:483px;--taskmap-shared-small-overscan:85.5px";
  const dispose = registerSmallOutputMask(plane);
  writeSmallOutputShapes(plane, [shape]);
  flush();
  const property = (name: string) => plane.style.getPropertyValue(`--taskmap-small-output-${name}`);
  const image = property("mask");
  expect(decodeURIComponent(image)).toContain('width="264" height="84" rx="13.5"');
  expect(image).toContain("linear-gradient(");
  // Viewport intersects the union of shapes; positions include the overscan origin.
  expect(property("mask-composite")).toBe("intersect, add");
  expect(property("mask-position")).toBe("97.5px 85.5px, 97.5px 5.5px");
  expect(property("mask-size")).toBe("264px 4px, 264px 84px");
  const styles = vi.spyOn(window, "getComputedStyle");
  writeSmallOutputShapes(plane, [{ ...shape, y: -82, clip: { ...shape.clip, height: 2 } }]);
  expect(property("mask-position")).toBe("97.5px 85.5px, 97.5px 3.5px");
  expect(property("mask-size")).toBe("264px 2px, 264px 84px");
  // Moving shapes reuse the cached image instead of encoding a new mask.
  expect(property("mask")).toBe(image);
  expect(styles).not.toHaveBeenCalled();
  expect(frames.size).toBe(0);
  // A hidden ancestor must not create an endless geometry refresh loop.
  plane.style.width = "0px";
  plane.style.height = "0px";
  window.dispatchEvent(new Event("resize"));
  flush();
  expect(frames.size).toBe(0);
  dispose();
  expect(writeSmallOutputShapes(plane, [])).toBe(false);
  expect(plane.style.getPropertyValue("--taskmap-small-output-mask")).toBe("");
});

it("falls back to one exact SVG mask when clips do not share a viewport", () => {
  expect(
    layeredOutputMask(
      [
        {
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          radius: 8,
          clip: { left: 0, top: 0, width: 100, height: 50 },
        },
        {
          x: 0,
          y: 200,
          width: 100,
          height: 100,
          radius: 8,
          clip: { left: 0, top: 200, width: 100, height: 100 },
        },
      ],
      10,
    ),
  ).toBeNull();
  // Opacity is baked into a cached, quantised image instead of re-encoding a whole-plane SVG.
  expect(
    layeredOutputMask([{ x: 0, y: 0, width: 10, height: 10, radius: 2, opacity: 0.5 }], 0)?.image,
  ).toContain(encodeURIComponent('fill-opacity="0.5"'));
  expect(
    layeredOutputMask([{ x: 0, y: 0, width: 10, height: 10, radius: 2, opacity: 0 }], 0)?.image,
  ).toContain("transparent");
  expect(layeredOutputMask([], 0)?.image).toContain("transparent");
});

it("switches masking without replacing filters and restores the latest legacy viewport on exit", () => {
  const view = (enabled: boolean) => (
    <SmallGlassOutputMaskEnabled.Provider value={enabled}>
      <SharedSmallGlassPlane />
    </SmallGlassOutputMaskEnabled.Provider>
  );
  const { container, rerender } = render(view(false));
  const plane = container.querySelector<HTMLElement>("[data-shared-small-glass-plane]")!;
  const filter = plane.querySelector("[data-native-filter-layer]");
  writeSharedSmallGlassShapes(plane, [shape]);
  rerender(view(true));
  expect(plane.style.clipPath).toBe("");
  writeSharedSmallGlassShapes(plane, [{ ...shape, y: -82, clip: { ...shape.clip, height: 2 } }]);
  rerender(view(false));
  expect(plane.querySelector("[data-native-filter-layer]")).toBe(filter);
  expect(plane.style.clipPath).toContain("url(");
  expect(plane.querySelector("[data-glass-viewport-clip] > rect")).toHaveAttribute("height", "2");
  expect(plane.querySelector("[data-shared-small-glass-clip] > rect")).toHaveAttribute("y", "-82");
});

it("morphs clipped scroll-edge shapes into rounded slices from cached corner caps", () => {
  const card = { x: 12, y: -40, width: 264, height: 84, radius: 13.5, morph: true };
  const slice = (top: number, height: number) =>
    layeredOutputMask(
      [
        { ...card, clip: { left: 12, top, width: 264, height } },
        { ...card, y: 54, clip: { left: 12, top: 54, width: 264, height: 84 } },
      ],
      10,
    )!;
  const first = slice(0, 44);
  // Top cap + middle + bottom cap for the edge card, one full image for the visible card.
  expect(first.composite).toBe("add, add, add, add");
  expect(first.position).toBe("22px 10px, 22px 22.5px, 22px 40.5px, 22px 64px");
  expect(first.size).toBe("264px 13.5px, 264px 19px, 264px 13.5px, 264px 84px");
  expect(first.composite).not.toContain("intersect");
  const second = slice(0, 30);
  expect(second.image).toBe(first.image);
  expect(second.size).toBe("264px 13.5px, 264px 5px, 264px 13.5px, 264px 84px");
  // A strip thinner than two radii keeps both caps, each half its height.
  expect(slice(0, 10).size).toBe("264px 5px, 264px 5px, 264px 84px");
});
