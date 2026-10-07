import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ContainerElement, ImageElement, TextCardElement } from "../types";
import { elementShadows, type ElementShadowState } from "./RetainedElementLayers";
import { useLayeredCanvasElements } from "./useLayeredCanvasElements";

const box = (id: string, layer?: number): ContainerElement => ({
  id,
  name: id,
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  accent: "#fff",
  ...(layer === undefined ? {} : { layer }),
});
const card: TextCardElement = { id: "card", text: "Card", x: 10, y: 20, accent: "#fff" };
const image: ImageElement = { id: "image", x: 0, y: 0, width: 50, height: 50, accent: "#fff" };
const none = { containers: [], textCards: [], textBlocks: [], images: [] };

describe("canvas layers", () => {
  it("numbers top-level elements in layer order and applies gesture previews", () => {
    const containers = [box("front", 5), box("back", 1)];
    const { result } = renderHook(() =>
      useLayeredCanvasElements({
        containers,
        textBlocks: [],
        textCards: [card, { ...card, id: "inside", containerId: "back" }],
        images: [],
        looseCards: [card],
        looseImages: [],
        previews: [{ id: "front", geometry: { x: 40, y: 0, width: 100, height: 100 } }],
      }),
    );

    expect(result.current.containers.map(({ id, layer, x }) => [id, layer, x])).toEqual([
      ["front", 1, 40],
      ["back", 0, 0],
    ]);
    expect(result.current.isTopLevel("card")).toBe(true);
    expect(result.current.isTopLevel("inside")).toBe(false);
    expect(result.current.cullable.map(({ id }) => id)).toEqual(["front", "back", "card"]);
  });

  it("keeps an element's identity while its layer is unchanged", () => {
    const containers = [box("only", 0)];
    const input = {
      containers,
      textBlocks: [],
      textCards: [],
      images: [],
      looseCards: [],
      looseImages: [],
      previews: [],
    };
    const { result } = renderHook(() => useLayeredCanvasElements(input));

    expect(result.current.containers[0]).toBe(containers[0]);
  });
});

describe("elementShadows", () => {
  const state = (overrides: Partial<ElementShadowState> = {}): ElementShadowState => ({
    deleting: none,
    overlaidCardIds: [],
    draggedCardIds: [],
    cardSize: () => ({ width: 80, height: 43 }),
    preview: () => undefined,
    chromeless: () => false,
    ...overrides,
  });
  const layers = { containers: [box("box")], textBlocks: [], looseCards: [card], images: [image] };

  it("shadows frames as shells and cards and images as cards", () => {
    expect(
      elementShadows(layers, state()).map(({ id, strength, radius }) => [id, strength, radius]),
    ).toEqual([
      ["box", "shell", 12],
      ["card", "card", 8],
      ["image", "card", 12],
    ]);
  });

  it("follows a moving card and drops shadows an overlay or a delete animation takes over", () => {
    const moving = elementShadows(layers, state({ preview: () => ({ x: 300, y: 200 }) }));
    expect(moving[1]).toMatchObject({ left: 300, top: 200, width: 80, height: 43 });

    const hidden = elementShadows(
      layers,
      state({
        overlaidCardIds: ["card"],
        deleting: { ...none, containers: ["box"] },
        chromeless: () => true,
      }),
    );
    expect(hidden).toEqual([]);
  });
});
