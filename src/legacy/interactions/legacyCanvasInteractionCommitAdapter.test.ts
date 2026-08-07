// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { MoveCommit, ResizeCommit } from "../../app/interactions/canvasInteractionTypes";
import type { TaskCanvas } from "../../types";
import {
  applyLayerOrder,
  applyMove,
  applyResize,
  createLegacyCanvasInteractionCommitAdapter,
} from "./legacyCanvasInteractionCommitAdapter";
import { getLegacyInteractionElements, projectLegacyGeometry } from "./legacyCanvasGeometry";

function canvas(): TaskCanvas {
  return {
    id: "canvas",
    name: "Canvas",
    width: 2000,
    height: 1200,
    pan: { x: 0, y: 0 },
    zoom: 1,
    containers: [
      {
        id: "container",
        name: "Container",
        x: 400,
        y: 300,
        width: 400,
        height: 300,
        accent: "#fff",
        layer: 0,
      },
      {
        id: "locked",
        name: "Locked",
        x: 20,
        y: 20,
        width: 300,
        height: 200,
        accent: "#fff",
        layer: 1,
        extensions: { lock: { enabled: true } },
      },
    ],
    textBlocks: [
      {
        id: "block",
        name: "Block",
        text: "",
        x: 900,
        y: 100,
        width: 300,
        height: 200,
        accent: "#fff",
        layer: 2,
      },
    ],
    textCards: [
      { id: "card", text: "Card", x: 100, y: 100, accent: "#fff", layer: 3 },
      {
        id: "inside",
        text: "Inside",
        x: 0,
        y: 0,
        accent: "#fff",
        containerId: "container",
        order: 0,
      },
    ],
    images: [{ id: "image", x: 1300, y: 100, width: 160, height: 80, accent: "#fff", layer: 4 }],
    mindmapConnections: [],
  };
}

function move(...targets: MoveCommit["targets"]): MoveCommit {
  return {
    primaryId: targets[0]?.id ?? "",
    targets,
    pointerWorld: { x: 0, y: 0 },
    screenDistance: 20,
    completionBehavior: "translate",
  };
}

describe("legacy canvas interaction commit adapter", () => {
  it("applies a multi-kind movement in one canvas replacement", () => {
    let current = canvas();
    const commitActiveCanvas = vi.fn((next: TaskCanvas) => {
      current = next;
    });
    const adapter = createLegacyCanvasInteractionCommitAdapter({
      getActiveCanvas: () => current,
      commitActiveCanvas,
    });
    const container = current.containers[0];
    const image = current.images[0];
    adapter.commitMove(
      move(
        { id: container.id, from: container, to: { ...container, x: 450, y: 350 } },
        { id: image.id, from: image, to: { ...image, x: 1400, y: 200 } },
      ),
    );
    expect(commitActiveCanvas).toHaveBeenCalledOnce();
    expect(current.containers[0]).toMatchObject({ x: 450, y: 350 });
    expect(current.images[0]).toMatchObject({ x: 1400, y: 200 });
  });

  it("does not replace the canvas for an empty/no-op completion", () => {
    const current = canvas();
    const commitActiveCanvas = vi.fn();
    const adapter = createLegacyCanvasInteractionCommitAdapter({
      getActiveCanvas: () => current,
      commitActiveCanvas,
    });
    adapter.commitMove(move());
    expect(commitActiveCanvas).not.toHaveBeenCalled();
  });

  it("preserves card bundle reparenting at the legacy boundary", () => {
    const current = canvas();
    const card = current.textCards[0];
    const operation = {
      ...move({
        id: card.id,
        from: { x: card.x, y: card.y, width: 220, height: 52 },
        to: { x: 500, y: 400, width: 220, height: 52 },
      }),
      pointerWorld: { x: 500, y: 400 },
      completionBehavior: "place" as const,
    };
    const next = applyMove(current, operation);
    expect(next.textCards.find(({ id }) => id === card.id)).toMatchObject({
      containerId: "container",
      order: 1,
    });
  });

  it("does not reparent an ordinary translated card group", () => {
    const current = canvas();
    const card = current.textCards[0];
    const next = applyMove(current, {
      ...move({
        id: card.id,
        from: { x: card.x, y: card.y, width: 220, height: 52 },
        to: { x: 500, y: 400, width: 220, height: 52 },
      }),
      pointerWorld: { x: 500, y: 400 },
    });
    const moved = next.textCards.find(({ id }) => id === card.id);
    expect(moved).toMatchObject({ x: 500, y: 400 });
    expect(moved).not.toHaveProperty("containerId");
  });

  it("applies one resize and returns the same canvas for no-op resize", () => {
    const current = canvas();
    const image = current.images[0];
    const operation: ResizeCommit = {
      id: image.id,
      handle: "bottom-right",
      from: image,
      to: { ...image, width: 240, height: 120 },
    };
    expect(applyResize(current, operation).images[0]).toMatchObject({ width: 240, height: 120 });
    expect(applyResize(current, { ...operation, to: operation.from })).toBe(current);
  });

  it("moves selected top-level items as an ordered group and ignores locks", () => {
    const current = canvas();
    const next = applyLayerOrder(current, new Set(["locked", "block"]), "front");
    expect(next.containers.find(({ id }) => id === "locked")?.layer).toBe(3);
    expect(next.textBlocks[0].layer).toBe(4);
    expect(applyLayerOrder(next, new Set(["missing"]), "front")).toBe(next);
  });
});

describe("legacy geometry boundary", () => {
  it("derives generic capabilities without cloning the document", () => {
    const current = canvas();
    const elements = getLegacyInteractionElements(current);
    expect(elements.find(({ id }) => id === "locked")).toMatchObject({
      locked: true,
      movable: true,
      resizable: true,
    });
    expect(elements.find(({ id }) => id === "card")).toMatchObject({ resizable: false });
  });

  it("clones only previewed render elements and leaves persistent geometry unchanged", () => {
    const current = canvas();
    const projected = projectLegacyGeometry(current.containers, [
      { id: "container", geometry: { x: 500, y: 600, width: 400, height: 300 } },
    ]);
    expect(projected[0]).not.toBe(current.containers[0]);
    expect(projected[1]).toBe(current.containers[1]);
    expect(current.containers[0]).toMatchObject({ x: 400, y: 300 });
  });
});
