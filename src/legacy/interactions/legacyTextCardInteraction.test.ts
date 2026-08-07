// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createCanvasInteractionController } from "../../app/interactions/canvasInteractionController";
import type { ElementGeometry } from "../../canvas/geometry/canvasGeometry";
import { createViewport } from "../../canvas/geometry/viewportMath";
import type { TaskCanvas } from "../../types";
import {
  applyMove,
  createLegacyCanvasInteractionCommitAdapter,
} from "./legacyCanvasInteractionCommitAdapter";
import {
  createLegacyTextCardInteractionService,
  getLegacyTextCardDragIds,
} from "./legacyTextCardInteraction";

const container = (id: string, x: number, query = "") => ({
  id,
  name: id,
  x,
  y: 0,
  width: 320,
  height: 400,
  accent: "#fff",
  ...(query ? { extensions: { search: { query } } } : {}),
});

function canvas(): TaskCanvas {
  return {
    id: "canvas",
    name: "Canvas",
    width: 1200,
    height: 800,
    pan: { x: 0, y: 0 },
    zoom: 1,
    containers: [container("left", 0), container("right", 500)],
    textBlocks: [],
    textCards: [
      { id: "a", text: "A", x: 17, y: 65, accent: "#fff", containerId: "left", order: 0 },
      { id: "b", text: "B", x: 17, y: 116, accent: "#fff", containerId: "left", order: 1 },
      { id: "c", text: "C", x: 17, y: 167, accent: "#fff", containerId: "left", order: 2 },
    ],
    images: [],
    mindmapConnections: [],
  };
}

function service() {
  return createLegacyTextCardInteractionService({
    requestFrame: vi.fn(() => 1),
    cancelFrame: vi.fn(),
    setTimer: vi.fn(() => 1),
    clearTimer: vi.fn(),
  });
}

function geometries(current: TaskCanvas): Map<string, ElementGeometry> {
  return new Map(
    current.textCards.map((card) => [card.id, { x: card.x, y: card.y, width: 180, height: 43 }]),
  );
}

function begin(
  interaction: ReturnType<typeof service>,
  current: TaskCanvas,
  primaryId: string,
  draggedIds: readonly string[] = [primaryId],
  pointerId = 1,
) {
  const geometry = geometries(current).get(primaryId)!;
  interaction.begin({
    pointerId,
    primaryId,
    draggedIds,
    cards: current.textCards,
    containers: current.containers,
    textBlocks: current.textBlocks,
    geometries: geometries(current),
    startScreen: { x: geometry.x, y: geometry.y + 10 },
    startWorld: { x: geometry.x, y: geometry.y + 10 },
    scrollOffsets: {},
  });
}

function update(interaction: ReturnType<typeof service>, x: number, y: number, shiftKey = false) {
  interaction.update({
    pointerId: 1,
    screen: { x, y },
    world: { x, y },
    primaryGeometry: { x, y: y - 10, width: 180, height: 43 },
    shiftKey,
  });
}

describe("legacy text-card transient placement", () => {
  it("reorders in both directions and requires directional midpoint progress", () => {
    const down = service();
    begin(down, canvas(), "a");
    update(down, 30, 140);
    expect(down.getDecision()?.visibleIndex).toBe(1);
    update(down, 30, 141);
    expect(down.getDecision()?.visibleIndex).toBe(1);
    update(down, 30, 240);
    expect(down.getDecision()?.realIndex).toBe(2);
    const starting = canvas();
    const movedDown = applyMove(
      starting,
      {
        primaryId: "a",
        targets: [
          {
            id: "a",
            from: geometries(starting).get("a")!,
            to: { x: 30, y: 230, width: 180, height: 43 },
          },
        ],
        pointerWorld: { x: 30, y: 240 },
        screenDistance: 100,
        completionBehavior: "place",
      },
      () => 0,
      down.getDecision(),
    );
    expect(
      movedDown.textCards
        .filter(({ containerId }) => containerId === "left")
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map(({ id }) => id),
    ).toEqual(["b", "c", "a"]);

    const up = service();
    begin(up, canvas(), "c");
    update(up, 30, 115);
    expect(up.getDecision()?.visibleIndex).toBe(1);
    update(up, 30, 60);
    expect(up.getDecision()?.realIndex).toBe(0);
    const movedUp = applyMove(
      starting,
      {
        primaryId: "c",
        targets: [
          {
            id: "c",
            from: geometries(starting).get("c")!,
            to: { x: 30, y: 50, width: 180, height: 43 },
          },
        ],
        pointerWorld: { x: 30, y: 60 },
        screenDistance: 100,
        completionBehavior: "place",
      },
      () => 0,
      up.getDecision(),
    );
    expect(
      movedUp.textCards
        .filter(({ containerId }) => containerId === "left")
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map(({ id }) => id),
    ).toEqual(["c", "a", "b"]);
  });

  it("captures cross-container reparent and detach-to-loose decisions", () => {
    const interaction = service();
    begin(interaction, canvas(), "a");
    update(interaction, 540, 100);
    expect(interaction.getDecision()).toMatchObject({ targetContainerId: "right", realIndex: 0 });
    expect(interaction.getSnapshot().active?.current).toEqual({ x: 540, y: 90 });
    update(interaction, 1100, 700);
    expect(interaction.getDecision()).toMatchObject({ targetContainerId: null, realIndex: null });
    const starting = canvas();
    const detached = applyMove(
      starting,
      {
        primaryId: "a",
        targets: [
          {
            id: "a",
            from: geometries(starting).get("a")!,
            to: { x: 1100, y: 690, width: 180, height: 43 },
          },
        ],
        pointerWorld: { x: 1100, y: 700 },
        screenDistance: 100,
        completionBehavior: "place",
      },
      () => 0,
      interaction.getDecision(),
    );
    expect(detached.textCards.find(({ id }) => id === "a")).toMatchObject({ x: 1100, y: 690 });
    expect(detached.textCards.find(({ id }) => id === "a")?.containerId).toBeUndefined();
  });

  it("maps a searched insertion slot into the unfiltered real order", () => {
    const current = canvas();
    current.containers[1] = container("right", 500, "visible");
    current.textCards.push(
      { id: "h1", text: "hidden one", x: 0, y: 0, accent: "#fff", containerId: "right", order: 0 },
      { id: "v1", text: "visible one", x: 0, y: 0, accent: "#fff", containerId: "right", order: 1 },
      { id: "h2", text: "hidden two", x: 0, y: 0, accent: "#fff", containerId: "right", order: 2 },
      { id: "v2", text: "visible two", x: 0, y: 0, accent: "#fff", containerId: "right", order: 3 },
    );
    const interaction = service();
    begin(interaction, current, "a");
    update(interaction, 540, 140);
    expect(interaction.getDecision()).toMatchObject({ visibleIndex: 1, realIndex: 3 });
    const placed = applyMove(
      current,
      {
        primaryId: "a",
        targets: [
          {
            id: "a",
            from: geometries(current).get("a")!,
            to: { x: 540, y: 130, width: 180, height: 43 },
          },
        ],
        pointerWorld: { x: 540, y: 140 },
        screenDistance: 100,
        completionBehavior: "place",
      },
      () => 0,
      interaction.getDecision(),
    );
    expect(
      placed.textCards
        .filter(({ containerId }) => containerId === "right")
        .sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
        .map(({ id }) => id),
    ).toEqual(["h1", "v1", "h2", "a", "v2"]);
  });

  it("preserves selected bundle order while keeping primary-card presentation offsets", () => {
    const interaction = service();
    begin(interaction, canvas(), "b", ["a", "b", "c"]);
    const active = interaction.getSnapshot().active!;
    expect(active.ids).toEqual(["a", "b", "c"]);
    expect(active.offsets[0].id).toBe("b");
    expect(interaction.getDecision()?.draggedIds).toEqual(["a", "b", "c"]);
  });

  it("excludes locked members from a selected contained-card bundle", () => {
    const current = canvas();
    current.textCards[1] = {
      ...current.textCards[1],
      extensions: { lock: { enabled: true } },
    };
    expect(getLegacyTextCardDragIds(current.textCards, "a", ["a", "b", "c"])).toEqual(["a", "c"]);
  });

  it("keeps all frames transient, cancels without commit, and commits once at completion", () => {
    let current = canvas();
    const interaction = service();
    const replace = vi.fn((next: TaskCanvas) => {
      current = next;
    });
    const controller = createCanvasInteractionController({
      canvasKey: current.id,
      viewport: createViewport(current.pan, current.zoom, { width: 800, height: 600 }),
      commitPort: createLegacyCanvasInteractionCommitAdapter({
        getActiveCanvas: () => current,
        commitActiveCanvas: replace,
        getTextCardPlacementDecision: interaction.getDecision,
        onTextCardPlacementCommitted: interaction.finishCommitted,
      }),
    });
    const target = {
      id: "a",
      geometry: geometries(current).get("a")!,
      locked: false,
      movable: true,
      resizable: false,
    };
    begin(interaction, current, "a");
    controller.beginMove({
      pointerId: 1,
      screen: { x: 17, y: 75 },
      primaryId: "a",
      targets: [target],
      snapTargets: [],
      commitThresholdScreen: 3,
      completionBehavior: "place",
    });
    for (let frame = 1; frame <= 20; frame += 1) {
      controller.updatePointer({
        pointerId: 1,
        screen: { x: 17 + frame, y: 75 + frame },
        snapping: false,
      });
      update(interaction, 17 + frame, 75 + frame);
    }
    expect(replace).not.toHaveBeenCalled();
    controller.cancelPointer(1);
    interaction.cancelActive(1);
    expect(replace).not.toHaveBeenCalled();

    begin(interaction, current, "a", ["a"], 2);
    controller.beginMove({
      pointerId: 2,
      screen: { x: 17, y: 75 },
      primaryId: "a",
      targets: [target],
      snapTargets: [],
      commitThresholdScreen: 3,
      completionBehavior: "place",
    });
    interaction.update({
      pointerId: 2,
      screen: { x: 540, y: 100 },
      world: { x: 540, y: 100 },
      primaryGeometry: { x: 540, y: 90, width: 180, height: 43 },
      shiftKey: false,
    });
    controller.completePointer({ pointerId: 2, screen: { x: 540, y: 100 }, snapping: false });
    expect(replace).toHaveBeenCalledOnce();
    expect(current.textCards.find(({ id }) => id === "a")?.containerId).toBe("right");
  });

  it("does not commit a contained-card drag below three screen pixels", () => {
    let current = canvas();
    const replace = vi.fn((next: TaskCanvas) => {
      current = next;
    });
    const controller = createCanvasInteractionController({
      canvasKey: current.id,
      viewport: createViewport(current.pan, current.zoom, { width: 800, height: 600 }),
      commitPort: createLegacyCanvasInteractionCommitAdapter({
        getActiveCanvas: () => current,
        commitActiveCanvas: replace,
      }),
    });
    const target = {
      id: "a",
      geometry: geometries(current).get("a")!,
      locked: false,
      movable: true,
      resizable: false,
    };
    controller.beginMove({
      pointerId: 1,
      screen: { x: 0, y: 0 },
      primaryId: "a",
      targets: [target],
      snapTargets: [],
      commitThresholdScreen: 3,
      completionBehavior: "place",
    });
    controller.completePointer({ pointerId: 1, screen: { x: 2, y: 0 }, snapping: false });
    expect(replace).not.toHaveBeenCalled();
  });
});
