// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { ElementGeometry } from "../../canvas/geometry/canvasGeometry";
import type { TaskCanvas } from "../../types";
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

    const up = service();
    begin(up, canvas(), "c");
    update(up, 30, 115);
    expect(up.getDecision()?.visibleIndex).toBe(1);
    update(up, 30, 60);
    expect(up.getDecision()?.realIndex).toBe(0);
  });

  it("captures cross-container reparent and detach-to-loose decisions", () => {
    const interaction = service();
    begin(interaction, canvas(), "a");
    update(interaction, 540, 100);
    expect(interaction.getDecision()).toMatchObject({ targetContainerId: "right", realIndex: 0 });
    expect(interaction.getSnapshot().active?.current).toEqual({ x: 540, y: 90 });
    update(interaction, 1100, 700);
    expect(interaction.getDecision()).toMatchObject({ targetContainerId: null, realIndex: null });
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
});
