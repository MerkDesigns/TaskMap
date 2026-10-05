// @vitest-environment node
import { describe, expect, it } from "vitest";
import { DEFAULT_ELEMENT_COLORS } from "../constants";
import {
  newContainer,
  newImagePlaceholder,
  newLooseTextCard,
  newTextBlock,
} from "./newCanvasElements";

const placement = (x: number, y: number) => ({
  id: "new",
  point: { x, y },
  canvas: { width: 2000, height: 1500 },
  colors: DEFAULT_ELEMENT_COLORS,
});

describe("new canvas elements", () => {
  it("opens a container centred under the pointer with its header grabbed, named by count", () => {
    expect(newContainer(placement(1000, 600), 2)).toEqual({
      id: "new",
      name: "Container 3",
      x: 820,
      y: 572,
      width: 360,
      height: 240,
      accent: DEFAULT_ELEMENT_COLORS.container,
    });
    expect(newTextBlock(placement(1000, 600), 0)).toMatchObject({
      name: "Text block 1",
      text: "Text block",
      x: 840,
      y: 572,
      accent: DEFAULT_ELEMENT_COLORS.textBlock,
    });
  });

  it("keeps new elements inside the canvas near its edges", () => {
    expect(newContainer(placement(10, 10), 0)).toMatchObject({ x: 0, y: 0 });
    expect(newImagePlaceholder(placement(1990, 1490))).toMatchObject({
      x: 1720,
      y: 1300,
      width: 280,
      height: 200,
    });
    expect(newLooseTextCard(placement(2100, -5), "Card")).toMatchObject({ x: 2000, y: 0 });
  });

  it("colours mind-map nodes and text cards with their own defaults", () => {
    expect(newLooseTextCard(placement(5, 5), "Mindmap", "mindmap")).toMatchObject({
      kind: "mindmap",
      accent: DEFAULT_ELEMENT_COLORS.mindmap,
    });
    expect(newLooseTextCard(placement(5, 5), "Text card").accent).toBe(
      DEFAULT_ELEMENT_COLORS.textCard,
    );
  });
});
