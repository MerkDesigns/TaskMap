// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { LegacyTextCardPresentation } from "./legacyTextCardInteraction";
import {
  getLegacyTextCardDragRenderPosition,
  isLegacyTextCardSpread,
} from "./legacyTextCardDragPresentation";

describe("legacy text-card drag presentation", () => {
  it("keeps measured interaction size out of the TextCardRenderer render position", () => {
    const presentation: LegacyTextCardPresentation = {
      pointerId: 1,
      primaryId: "primary",
      ids: ["primary", "bundle"],
      start: { x: 10, y: 20 },
      current: { x: 35, y: 45 },
      latestScreen: { x: 35, y: 45 },
      latestWorld: { x: 35, y: 45 },
      size: { width: 187, height: 63 },
      offsets: [
        { id: "primary", x: 0, y: 0, formation: { x: 0, y: 0 }, depth: 0 },
        { id: "bundle", x: 3, y: 4, formation: { x: 7, y: 8 }, depth: 1 },
      ],
      sway: { x: 2, y: 1 },
      trueSize: true,
      stackedAtPickup: false,
      spread: true,
      targetContainerId: null,
      insertionIndex: null,
      dropPreview: null,
    };

    expect(getLegacyTextCardDragRenderPosition(presentation, "primary")).toEqual({
      x: 35,
      y: 45,
    });
    expect(getLegacyTextCardDragRenderPosition(presentation, "bundle")).toEqual({
      x: 42,
      y: 53,
    });
    expect(presentation.size).toEqual({ width: 187, height: 63 });
  });

  it("shows held cards in their arrangement over canvas and stacked over a container", () => {
    const presentation: LegacyTextCardPresentation = {
      pointerId: 1,
      primaryId: "primary",
      ids: ["primary", "bundle"],
      start: { x: 0, y: 0 },
      current: { x: 100, y: 50 },
      latestScreen: { x: 100, y: 50 },
      latestWorld: { x: 100, y: 50 },
      size: { width: 180, height: 43 },
      offsets: [
        { id: "primary", x: 0, y: 0, formation: { x: 0, y: 0 }, depth: 1 },
        { id: "bundle", x: 7, y: 4, formation: { x: -120, y: 60 }, depth: 0 },
      ],
      sway: { x: 0, y: 0 },
      trueSize: false,
      stackedAtPickup: false,
      spread: true,
      targetContainerId: null,
      insertionIndex: null,
      dropPreview: null,
    };

    expect(getLegacyTextCardDragRenderPosition(presentation, "bundle")).toEqual({ x: -20, y: 110 });
    expect(isLegacyTextCardSpread(presentation)).toBe(true);
    const over = {
      ...presentation,
      targetContainerId: "container",
      insertionIndex: 0,
      spread: false,
    };
    expect(getLegacyTextCardDragRenderPosition(over, "bundle")).toEqual({ x: 107, y: 54 });
    expect(isLegacyTextCardSpread(over)).toBe(false);
  });
});
