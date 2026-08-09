import { describe, expect, it, vi } from "vitest";
import type { ContainerElement, TaskCanvas } from "../../types";
import { projectLegacyBackdropScene } from "./legacyBackdropScene";
import {
  advanceLegacyBackdropSceneRevision,
  type LegacyBackdropSceneRevisionInput,
} from "./legacyBackdropSceneRevision";

describe("legacy BackdropScene presentation adapter", () => {
  it("projects the production container body, accent header, border, and radii", () => {
    const current = canvas([
      {
        id: "container",
        name: "Container",
        x: 10,
        y: 20,
        width: 300,
        height: 180,
        accent: "#345678",
      },
    ]);
    const scene = project(current);

    expect(scene.primitives).toHaveLength(3);
    expect(scene.primitives[0]).toMatchObject({
      kind: "filled-rounded-rectangle",
      bounds: { x: 10, y: 20, width: 300, height: 180 },
      radiusWorld: 12,
      fill: "#1b1b1e",
      stroke: { color: "#345678", widthWorld: 2 },
    });
    expect(scene.primitives.slice(1).map((primitive) => primitive.fill)).toEqual([
      "#345678",
      "#345678",
    ]);
    expect(scene.primitives[1]).toMatchObject({
      bounds: { x: 12, y: 22, width: 296, height: 48 },
      radiusWorld: 10,
    });

    current.containers[0].extensions = { search: { query: "" } };
    expect(project(current).primitives[1].bounds.height).toBe(90);
  });

  it("projects text blocks as a neutral body followed by the real 40px accent header", () => {
    const current = canvas([]);
    current.textBlocks.push({
      id: "block",
      name: "Block",
      text: "not rasterized",
      x: 30,
      y: 40,
      width: 240,
      height: 160,
      accent: "#aa5500",
      layer: 4,
    });

    const scene = project(current);

    expect(scene.primitives.map((primitive) => primitive.fill)).toEqual([
      "#1b1b1e",
      "#aa5500",
      "#aa5500",
    ]);
    expect(scene.primitives[1].bounds).toEqual({ x: 32, y: 42, width: 236, height: 40 });
  });

  it("keeps loose text-card and mind-map body geometry without sending text", () => {
    const current = canvas([]);
    current.textCards.push(
      { id: "card", text: "private text", x: 20, y: 30, accent: "#ff00aa", layer: 1 },
      {
        id: "mindmap",
        kind: "mindmap",
        text: "private node",
        x: 80,
        y: 100,
        accent: "#00aaff",
        layer: 2,
      },
    );
    const scene = projectLegacyBackdropScene({
      ...projectionInput(current),
      textCardSizes: new Map([
        ["card", { width: 180, height: 52 }],
        ["mindmap", { width: 210, height: 67 }],
      ]),
    });

    expect(scene.primitives.map((primitive) => primitive.bounds)).toEqual([
      { x: 20, y: 30, width: 180, height: 52 },
      { x: 80, y: 100, width: 210, height: 67 },
    ]);
    expect(scene.primitives.map((primitive) => primitive.stroke?.color)).toEqual([
      "#ff00aa",
      "#00aaff",
    ]);
    expect(scene).not.toHaveProperty("text");
    scene.primitives.forEach((primitive) => expect(primitive).not.toHaveProperty("text"));
  });

  it("derives contained-card placement from the existing read-only legacy layout helper", () => {
    const current = canvas([
      {
        id: "container",
        name: "Container",
        x: 100,
        y: 200,
        width: 300,
        height: 260,
        accent: "#225566",
        layer: 3,
      },
    ]);
    current.textCards.push({
      id: "contained",
      text: "contained private text",
      x: 0,
      y: 0,
      accent: "#bb7788",
      containerId: "container",
      order: 0,
    });

    const scene = projectLegacyBackdropScene({
      ...projectionInput(current),
      textCardSizes: new Map([["contained", { width: 266, height: 43 }]]),
    });

    expect(scene.primitives[3]).toMatchObject({
      bounds: { x: 117, y: 265, width: 266, height: 43 },
      fill: "#1b1b1e",
      stroke: { color: "#bb7788", widthWorld: 1 },
    });
  });

  it("uses resolved settled layer values and advances revision only for settled inputs", () => {
    const current = canvas([]);
    current.textCards.push(
      { id: "back", text: "Back", x: 10, y: 10, accent: "#111111", layer: 0 },
      { id: "front", text: "Front", x: 20, y: 20, accent: "#222222", layer: 1 },
    );
    const initialInput = revisionInput(current);
    let revision = advanceLegacyBackdropSceneRevision(null, initialInput);
    for (let sample = 0; sample < 120; sample += 1) {
      revision = advanceLegacyBackdropSceneRevision(revision, initialInput);
    }
    expect(revision.revision).toBe(1);
    expect(project(current).primitives.map((primitive) => primitive.stroke?.color)).toEqual([
      "#111111",
      "#222222",
    ]);

    const reordered = canvas([]);
    reordered.textCards.push(
      { ...current.textCards[0], layer: 1 },
      { ...current.textCards[1], layer: 0 },
    );
    revision = advanceLegacyBackdropSceneRevision(revision, revisionInput(reordered));

    expect(revision.revision).toBe(2);
    expect(project(reordered).primitives.map((primitive) => primitive.stroke?.color)).toEqual([
      "#222222",
      "#111111",
    ]);
  });

  it("culls a 10,000-model-element scene to viewport-plus-margin without DOM measurement", () => {
    const getBounds = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect");
    const containers = Array.from({ length: 10_000 }, (_, index): ContainerElement => ({
      id: `container-${index}`,
      name: `Container ${index}`,
      x: index < 6 ? index * 60 : 100_000 + index * 10,
      y: index < 6 ? index * 40 : 100_000,
      width: 40,
      height: 30,
      accent: "#123456",
    }));
    const scene = project(canvas(containers));

    expect(scene.primitives).toHaveLength(18);
    expect(getBounds).not.toHaveBeenCalled();
    getBounds.mockRestore();
  });
});

function project(current: TaskCanvas) {
  return projectLegacyBackdropScene(projectionInput(current));
}

function projectionInput(current: TaskCanvas) {
  return {
    canvas: current,
    sceneRevision: 7,
    gridStyle: "lines" as const,
    gridOpacityPercent: 15,
    cacheWorldBounds: { x: 0, y: 0, width: 500, height: 400 },
    anchorZoom: 1.5,
  };
}

function revisionInput(current: TaskCanvas): LegacyBackdropSceneRevisionInput {
  return {
    canvas: current,
    gridStyle: "lines",
    gridOpacityPercent: 15,
    textCardSizes: new Map(),
  };
}

function canvas(containers: ContainerElement[]): TaskCanvas {
  return {
    id: "canvas-a",
    name: "Canvas",
    width: 1_000_000,
    height: 1_000_000,
    containers,
    textCards: [],
    textBlocks: [],
    images: [],
    mindmapConnections: [],
    pan: { x: 0, y: 0 },
    zoom: 1,
  };
}
