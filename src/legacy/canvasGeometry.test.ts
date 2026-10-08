import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CanvasInteractionController } from "../app/interactions/canvasInteractionTypes";
import type { ContainerElement, TextCardElement } from "../types";
import { createCanvasGeometry } from "./canvasGeometry";
import { createContainerCardLayout, groupContainerCards } from "./containerCardLayout";
import { useCanvasScene } from "./useCanvasScene";

const box: ContainerElement = {
  id: "box",
  name: "Box",
  x: 100,
  y: 0,
  width: 300,
  height: 200,
  accent: "#fff",
};
const inside: TextCardElement = {
  id: "inside",
  text: "Inside",
  x: 0,
  y: 0,
  accent: "#fff",
  containerId: "box",
  order: 0,
};
const node: TextCardElement = {
  id: "node",
  text: "Idea",
  x: 40,
  y: 50,
  accent: "#fff",
  kind: "mindmap",
};

function setup(
  previews = [] as {
    id: string;
    geometry: { x: number; y: number; width: number; height: number };
  }[],
) {
  const cards = [inside, node];
  const { result } = renderHook(() =>
    useCanvasScene({
      containers: [box],
      textBlocks: [],
      textCards: cards,
      images: [],
      connections: [],
    }),
  );
  const world = {
    getBoundingClientRect: () => ({ left: 10, top: 20 }),
    querySelector: () => null,
  } as unknown as HTMLDivElement;
  return createCanvasGeometry({
    worldRef: { current: world },
    controller: {
      getSnapshot: () => ({ viewport: { zoom: 2, pan: { x: 0, y: 0 } } }),
    } as unknown as CanvasInteractionController,
    canvas: { width: 1000, height: 800 },
    scene: result.current,
    cardLayout: createContainerCardLayout(cards, groupContainerCards(cards), {}),
    restingPosition: () => ({ x: 117, y: 65 }),
    measuredCardSizes: new Map([["node", { width: 108, height: 40 }]]),
    interactionElements: [],
    previews,
    isLocked: () => false,
  });
}

describe("createCanvasGeometry", () => {
  it("converts pointer positions to canvas units inside the canvas", () => {
    const geometry = setup();

    expect(geometry.canvasPoint({ clientX: 210, clientY: 120 })).toEqual({ x: 100, y: 50 });
    expect(geometry.canvasPoint({ clientX: -50, clientY: 99999 })).toEqual({ x: 0, y: 800 });
  });

  it("shows a card at its preview while it moves and in its row inside a container", () => {
    const moving = setup([{ id: "node", geometry: { x: 300, y: 400, width: 1, height: 1 } }]);

    expect(moving.renderPosition(node)).toEqual({ x: 300, y: 400 });
    expect(moving.renderPosition(inside)).toEqual({ x: 117, y: 65 });
    expect(setup().renderPosition(node)).toBeUndefined();
  });

  it("lets gestures reach contained cards only when asked, at their row with a default size", () => {
    const geometry = setup();

    expect(geometry.gestureElement("inside")).toBeNull();
    expect(geometry.gestureElement("inside", true)).toMatchObject({
      geometry: { x: 117, y: 65, width: 215, height: 43 },
      resizable: false,
    });
  });

  it("offers a container's shown cards as move targets at their bounds", () => {
    const [candidate] = setup().containerCardCandidates(box);

    expect(candidate).toMatchObject({ id: "inside", locked: false, resizable: false });
    expect(candidate?.geometry).toMatchObject({ x: 117, height: 43 });
  });

  it("anchors connections to mind-map nodes at their measured size", () => {
    expect(setup().connectableBounds().get("node")).toEqual({
      x: 40,
      y: 50,
      width: 108,
      height: 40,
    });
  });
});
