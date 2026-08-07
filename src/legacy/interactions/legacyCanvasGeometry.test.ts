// @vitest-environment node
import { describe, expect, it } from "vitest";
import { selectIntersectingIds } from "../../app/interactions/selectionEngine";
import { prepareSnapTargets, snapMovedGeometry } from "../../app/interactions/snappingEngine";
import type { TaskCanvas } from "../../types";
import {
  estimateLegacyLooseTextCardSize,
  filterLegacyResizeSnapTargets,
  getLegacyInteractionElements,
} from "./legacyCanvasGeometry";

function canvas(): TaskCanvas {
  return {
    id: "canvas",
    name: "Canvas",
    width: 2000,
    height: 1200,
    pan: { x: 0, y: 0 },
    zoom: 1,
    containers: [
      { id: "visible", name: "Visible", x: 0, y: 0, width: 200, height: 200, accent: "#fff" },
      {
        id: "offscreen",
        name: "Offscreen",
        x: 1000,
        y: 0,
        width: 200,
        height: 200,
        accent: "#fff",
      },
    ],
    textBlocks: [],
    textCards: [
      { id: "card", text: "Card", x: 100, y: 300, accent: "#fff" },
      { id: "mindmap", kind: "mindmap", text: "Mind map", x: 300, y: 300, accent: "#fff" },
      { id: "contained", text: "Inside", x: 0, y: 0, accent: "#fff", containerId: "visible" },
    ],
    images: [],
    mindmapConnections: [],
  };
}

describe("legacy interaction geometry", () => {
  it("uses text-derived normal-card bounds instead of culling bounds", () => {
    const card = canvas().textCards[0];
    expect(estimateLegacyLooseTextCardSize(card)).toEqual({ width: 84, height: 43 });
    expect(
      getLegacyInteractionElements(canvas()).find(({ id }) => id === "card")?.geometry,
    ).toEqual({ x: 100, y: 300, width: 84, height: 43 });
    expect(
      getLegacyInteractionElements(canvas(), new Map([["card", { width: 132, height: 47 }]])).find(
        ({ id }) => id === "card",
      )?.geometry,
    ).toEqual({ x: 100, y: 300, width: 132, height: 47 });
  });

  it("uses measured mind-map bounds with a stable text-derived fallback", () => {
    const current = canvas();
    const fallback = getLegacyInteractionElements(current).find(({ id }) => id === "mindmap")!;
    expect(fallback.geometry).toEqual({ x: 300, y: 300, width: 120, height: 43 });
    const measured = getLegacyInteractionElements(
      current,
      new Map([["mindmap", { width: 180, height: 91 }]]),
    ).find(({ id }) => id === "mindmap")!;
    expect(measured.geometry).toEqual({ x: 300, y: 300, width: 180, height: 91 });
  });

  it("keeps near-but-outside selection and snapping tied to actual card bounds", () => {
    const card = getLegacyInteractionElements(canvas()).find(({ id }) => id === "card")!;
    expect(selectIntersectingIds({ x: 190, y: 300, width: 5, height: 20 }, [card])).toEqual([]);
    const snapped = snapMovedGeometry(
      { x: 131, y: 0, width: 50, height: 40 },
      false,
      prepareSnapTargets([card]),
      { x: 0, y: 0 },
    );
    expect(snapped.geometry.x).toBe(134);
  });

  it("excludes off-screen same-kind resize targets and contained generic move targets", () => {
    const elements = getLegacyInteractionElements(canvas());
    const filtered = filterLegacyResizeSnapTargets(elements, {
      activeId: "visible",
      activeKind: "container",
      containerIds: new Set(["visible", "offscreen"]),
      textBlockIds: new Set(),
      visibleIds: new Set(["visible"]),
    });
    expect(filtered).toEqual([]);
    expect(elements.some(({ id }) => id === "contained")).toBe(false);
  });
});
