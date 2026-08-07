// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { LegacyTextCardPresentation } from "./legacyTextCardInteraction";
import { getLegacyTextCardDragRenderPosition } from "./legacyTextCardDragPresentation";

describe("legacy text-card drag presentation", () => {
  it("keeps measured interaction size out of the TextCardNode render position", () => {
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
        { id: "primary", x: 0, y: 0, pickupX: 4, pickupY: 5 },
        { id: "bundle", x: 7, y: 8, pickupX: 2, pickupY: 3 },
      ],
      sway: { x: 2, y: 1 },
      trueSize: true,
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
});
