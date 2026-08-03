import { describe, expect, it } from "vitest";
import type { TaskCanvas } from "../types";
import { planCanvasDeletion, updateCanvasDetails } from "./canvasDocument";

const canvas: TaskCanvas = {
  id: "canvas",
  name: "Old",
  width: 3000,
  height: 3000,
  containers: [
    {
      id: "container",
      name: "Container",
      x: 2900,
      y: 2900,
      width: 500,
      height: 400,
      accent: "#333",
    },
  ],
  textCards: [{ id: "card", text: "Card", x: 3100, y: 3200, accent: "#333" }],
  textBlocks: [
    {
      id: "block",
      name: "Block",
      text: "Body",
      x: 2900,
      y: 2900,
      width: 500,
      height: 400,
      accent: "#333",
    },
  ],
  images: [{ id: "image", x: 2900, y: 2900, width: 500, height: 400, accent: "#333" }],
  mindmapConnections: [],
  pan: { x: 10, y: 20 },
  zoom: 1.2,
};

describe("updateCanvasDetails", () => {
  it("updates metadata and keeps every element inside the resized canvas", () => {
    const updated = updateCanvasDetails(canvas, { name: "New", width: 1000, height: 800 });

    expect(updated.name).toBe("New");
    expect(updated.containers[0]).toMatchObject({ x: 500, y: 400, width: 500, height: 400 });
    expect(updated.textCards[0]).toMatchObject({ x: 1000, y: 800 });
    expect(updated.textBlocks[0]).toMatchObject({ x: 500, y: 400, width: 500, height: 400 });
    expect(updated.images[0]).toMatchObject({ x: 500, y: 400, width: 500, height: 400 });
    expect(updated.pan).toEqual(canvas.pan);
  });

  it("does not mutate the source canvas", () => {
    const updated = updateCanvasDetails(canvas, { name: "New", width: 1000, height: 800 });

    expect(updated).not.toBe(canvas);
    expect(canvas.width).toBe(3000);
    expect(canvas.containers[0].x).toBe(2900);
  });
});

describe("planCanvasDeletion", () => {
  const deletionCanvas: TaskCanvas = {
    ...canvas,
    containers: [
      { id: "container", name: "Container", x: 0, y: 0, width: 300, height: 200, accent: "#333" },
    ],
    textCards: [
      {
        id: "contained-card",
        text: "Contained",
        x: 0,
        y: 0,
        accent: "#333",
        containerId: "container",
      },
      { id: "loose-card", text: "Loose", x: 0, y: 0, accent: "#333" },
    ],
    textBlocks: [],
    images: [
      {
        id: "contained-image",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        accent: "#333",
        containerId: "container",
      },
    ],
  };

  it("does not schedule contained items twice when their container is removed", () => {
    expect(
      planCanvasDeletion(
        deletionCanvas,
        ["container", "contained-card", "contained-image", "loose-card"],
        () => false,
      ),
    ).toEqual({
      containerIds: ["container"],
      textCardIds: ["loose-card"],
      textBlockIds: [],
      imageIds: [],
    });
  });

  it("keeps locked elements while allowing independently selected unlocked children", () => {
    expect(
      planCanvasDeletion(
        deletionCanvas,
        ["container", "contained-card", "contained-image"],
        (id) => id === "container" || id === "contained-image",
      ),
    ).toEqual({
      containerIds: [],
      textCardIds: ["contained-card"],
      textBlockIds: [],
      imageIds: [],
    });
  });
});
