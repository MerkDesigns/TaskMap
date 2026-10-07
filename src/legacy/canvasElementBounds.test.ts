import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ContainerElement, ImageElement, TextCardElement } from "../types";
import {
  clipToContainer,
  connectableBounds,
  connectableElementBounds,
  looseCardBounds,
  useMeasuredTextCardSizes,
} from "./canvasElementBounds";

const box: ContainerElement = {
  id: "box",
  name: "Box",
  x: 0,
  y: 100,
  width: 300,
  height: 200,
  accent: "#fff",
};
const image: ImageElement = { id: "image", x: 10, y: 20, width: 200, height: 100, accent: "#fff" };
const card = (id: string, text: string, kind?: "mindmap"): TextCardElement => ({
  id,
  text,
  x: 40,
  y: 50,
  accent: "#fff",
  ...(kind ? { kind } : {}),
});
const node = card("node", "Idea", "mindmap");

describe("canvas element bounds", () => {
  it("estimates an unmeasured card from its text and uses the measured size once known", () => {
    expect(looseCardBounds(card("short", "Hi"))).toEqual({
      left: 40,
      top: 50,
      width: 66,
      height: 43,
    });
    // A mind-map node grows a line for each wrapped line of text.
    expect(looseCardBounds(card("long", "a\nb\nc", "mindmap")).height).toBe(43 + 2 * 24);
    expect(looseCardBounds(node, { width: 108, height: 40 })).toMatchObject({
      width: 108,
      height: 40,
    });
  });

  it("attaches connections to previewed geometry while an element moves", () => {
    const bounds = connectableBounds(
      { containers: [box], textBlocks: [], images: [image], mindmapNodes: [node] },
      (current) => looseCardBounds(current, { width: 108, height: 40 }),
      (id) => (id === "node" ? { x: 400, y: 300 } : undefined),
    );

    expect(bounds.get("image")).toEqual({ x: 10, y: 20, width: 200, height: 100 });
    expect(bounds.get("node")).toEqual({ x: 400, y: 300, width: 108, height: 40 });
  });

  it("lets only frames, images and mind-map nodes connect", () => {
    const find = {
      element: (id: string) => (id === "image" ? image : undefined),
      card: (id: string) => [node, card("plain", "Plain")].find((current) => current.id === id),
    };
    const bounds = (current: TextCardElement) => looseCardBounds(current, { width: 1, height: 1 });

    expect(connectableElementBounds("image", find, bounds)).toEqual({
      x: 10,
      y: 20,
      width: 200,
      height: 100,
    });
    expect(connectableElementBounds("node", find, bounds)).toEqual({
      x: 40,
      y: 50,
      width: 1,
      height: 1,
    });
    expect(connectableElementBounds("plain", find, bounds)).toBeNull();
  });

  it("clips a contained card's row under the header and squares off the clipped edge", () => {
    // The card area starts below the 48 px header, at y = 148.
    const clipped = clipToContainer(box, { left: 17, top: 130, width: 266, height: 43 });

    expect(clipped).toMatchObject({ top: 148, height: 25, borderTopLeftRadius: 0 });
    expect(clipped).toMatchObject({ borderBottomLeftRadius: 8 });
    expect(clipToContainer(box, { left: 17, top: 80, width: 266, height: 43 })).toBeNull();
  });

  it("forgets card sizes measured on another canvas", () => {
    const { result, rerender } = renderHook(({ canvas }) => useMeasuredTextCardSizes(canvas), {
      initialProps: { canvas: "first" },
    });

    act(() => result.current.remember("card", { width: 120, height: 43 }));
    expect(result.current.sizes.get("card")).toEqual({ canvasId: "first", width: 120, height: 43 });
    rerender({ canvas: "second" });
    expect(result.current.sizes.has("card")).toBe(false);
  });
});
