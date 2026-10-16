// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { ElementGeometry } from "../../canvas/geometry/canvasGeometry";
import type { TaskCanvas } from "../../types";
import {
  createLegacyTextCardInteractionService,
  createLegacyTextCardStructureSelector,
  getLegacyTextCardDragIds,
} from "./legacyTextCardInteraction";
import { isLooseTextCardSelection } from "./legacyTextCardPlacement";

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

/** Loose cards p (top), q (held), r (bottom) beside two containers, plus a mind-map node. */
function looseCanvas(): TaskCanvas {
  const current = canvas();
  current.textCards.push(
    { id: "q", text: "Q", x: 820, y: 640, accent: "#fff" },
    { id: "p", text: "P", x: 700, y: 600, accent: "#fff" },
    { id: "r", text: "R", x: 760, y: 700, accent: "#fff" },
    { id: "node", text: "Node", x: 900, y: 500, accent: "#fff", kind: "mindmap" },
  );
  return current;
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

  it("drags every selected loose card of an all-loose-card selection in reading order", () => {
    const current = looseCanvas();
    expect(isLooseTextCardSelection(current.textCards, ["p", "q", "r"])).toBe(true);
    expect(getLegacyTextCardDragIds(current.textCards, "q", ["r", "q", "p"])).toEqual([
      "p",
      "q",
      "r",
    ]);
    current.textCards = current.textCards.map((card) =>
      card.id === "r" ? { ...card, extensions: { lock: { enabled: true } } } : card,
    );
    expect(getLegacyTextCardDragIds(current.textCards, "q", ["p", "q", "r"])).toEqual(["p", "q"]);
    for (const mixed of [
      ["p", "q", "left"],
      ["p", "q", "a"],
      ["p", "q", "node"],
    ]) {
      expect(isLooseTextCardSelection(current.textCards, mixed)).toBe(false);
      expect(getLegacyTextCardDragIds(current.textCards, "q", mixed)).toEqual(["q"]);
    }
  });

  it("keeps loose cards in their arrangement over canvas and stacks them over a container", () => {
    const interaction = service();
    const current = looseCanvas();
    begin(interaction, current, "q", ["p", "q", "r"]);
    update(interaction, 1000, 600);
    const spread = interaction.getDecision()!;
    const position = (id: string) => spread.loosePositions.find((item) => item.id === id)!;
    expect(spread.targetContainerId).toBeNull();
    expect({ x: position("p").x - position("q").x, y: position("p").y - position("q").y }).toEqual({
      x: 700 - 820,
      y: 600 - 640,
    });
    expect(position("r").y - position("q").y).toBe(700 - 640);

    update(interaction, 540, 100);
    const stacked = interaction.getDecision()!;
    expect(stacked).toMatchObject({ targetContainerId: "right", draggedIds: ["p", "q", "r"] });
    const primary = stacked.loosePositions.find((item) => item.id === "q")!;
    for (const item of stacked.loosePositions) {
      expect(Math.abs(item.x - primary.x)).toBeLessThanOrEqual(13);
      expect(Math.abs(item.y - primary.y)).toBeLessThanOrEqual(20);
    }

    update(interaction, 1000, 600);
    expect(interaction.getDecision()?.loosePositions).toEqual(spread.loosePositions);
  });

  it("keeps the structural snapshot while moves only carry the held cards along", () => {
    const interaction = service();
    const structure = createLegacyTextCardStructureSelector(interaction);
    begin(interaction, looseCanvas(), "q", ["p", "q"]);
    const started = structure();
    expect(started.active?.ids).toEqual(["p", "q"]);
    update(interaction, 1000, 600);
    update(interaction, 1010, 610);
    expect(structure()).toBe(started);
    expect(interaction.getSnapshot()).not.toBe(started);
    update(interaction, 540, 100);
    expect(structure()).not.toBe(started);
    expect(structure().active?.targetContainerId).toBe("right");
  });

  it("keeps cards taken from a container in their rows over canvas", () => {
    const interaction = service();
    begin(interaction, canvas(), "b", ["a", "b", "c"]);
    update(interaction, 1000, 600);
    const decision = interaction.getDecision()!;
    expect(decision.targetContainerId).toBeNull();
    const position = (id: string) => decision.loosePositions.find((item) => item.id === id)!;
    expect(position("a")).toEqual({ id: "a", x: position("b").x, y: position("b").y - 51 });
    expect(position("c")).toEqual({ id: "c", x: position("b").x, y: position("b").y + 51 });
  });

  it("keeps held cards in the order they were painted in, also when they settle", () => {
    const current = looseCanvas();
    const layers: Record<string, number> = { p: 7, q: 9, r: 3 };
    current.textCards = current.textCards.map((card) =>
      card.id in layers ? { ...card, layer: layers[card.id] } : card,
    );
    const interaction = service();
    begin(interaction, current, "q", ["p", "q", "r"]);
    const depth = (id: string) =>
      interaction.getSnapshot().active!.offsets.find((offset) => offset.id === id)!.depth;
    expect([depth("r"), depth("p"), depth("q")]).toEqual([0, 1, 2]);

    update(interaction, 1000, 600);
    interaction.finish(current);
    expect(interaction.getSnapshot().release?.cards.map(({ card }) => card.id)).toEqual([
      "r",
      "p",
      "q",
    ]);
  });

  it("keeps the held cards' own slot open in their container from the moment they are grabbed", () => {
    const slot = (primaryId: string, draggedIds: readonly string[]) => {
      const interaction = service();
      begin(interaction, canvas(), primaryId, draggedIds);
      const { targetContainerId, insertionIndex, stackedAtPickup } =
        interaction.getSnapshot().active!;
      return { targetContainerId, insertionIndex, stackedAtPickup };
    };
    const own = { targetContainerId: "left", stackedAtPickup: true };
    expect(slot("b", ["b"])).toEqual({ ...own, insertionIndex: 1 });
    expect(slot("a", ["a", "b"])).toEqual({ ...own, insertionIndex: 0 });
    expect(slot("b", ["a", "b"])).toEqual({ ...own, insertionIndex: 0 });
    expect(slot("c", ["a", "c"])).toEqual({ ...own, insertionIndex: 1 });

    const loose = service();
    begin(loose, looseCanvas(), "q", ["p", "q"]);
    expect(loose.getSnapshot().active).toMatchObject({
      targetContainerId: null,
      stackedAtPickup: false,
    });
  });

  it("waits a moment before spreading the stack, so crossing the gap between containers keeps it", () => {
    const timers: { callback: () => void; delay: number }[] = [];
    const interaction = createLegacyTextCardInteractionService({
      requestFrame: vi.fn(() => 1),
      cancelFrame: vi.fn(),
      setTimer: (callback, delay) => timers.push({ callback, delay }),
      clearTimer: (handle) => {
        timers[handle - 1] = { callback: () => undefined, delay: 0 };
      },
    });
    const fire = () => timers.splice(0).forEach(({ callback }) => callback());
    begin(interaction, canvas(), "a", ["a", "b"]);
    const spread = () => interaction.getSnapshot().active!.spread;
    expect(spread()).toBe(false);

    update(interaction, 420, 100);
    expect(interaction.getDecision()?.targetContainerId).toBeNull();
    expect(spread()).toBe(false);
    update(interaction, 540, 100);
    fire();
    expect(interaction.getDecision()?.targetContainerId).toBe("right");
    expect(spread()).toBe(false);

    update(interaction, 1000, 600);
    expect(timers[timers.length - 1]?.delay).toBe(150);
    const shownBeforeSpread = interaction.getSnapshot().active!.current;
    interaction.finish(canvas());
    const release = interaction.getSnapshot().release!.cards;
    for (const { from } of release) {
      expect(Math.abs(from.x - shownBeforeSpread.x)).toBeLessThanOrEqual(13);
      expect(Math.abs(from.y - shownBeforeSpread.y)).toBeLessThanOrEqual(20);
    }

    begin(interaction, canvas(), "a", ["a", "b"]);
    update(interaction, 1000, 600);
    expect(spread()).toBe(false);
    fire();
    expect(spread()).toBe(true);
  });

  it("settles gathered cards back into their rows when the drag changes nothing", () => {
    const current = canvas();
    const gathered = service();
    begin(gathered, current, "a", ["a", "b"]);
    gathered.finish(current);
    const settling = gathered.getSnapshot().release!.cards;
    const b = settling.find(({ card }) => card.id === "b")!;
    expect(b.to).toEqual({ x: 17, y: 116 });
    expect(b.from).not.toEqual(b.to);

    const clicked = service();
    begin(clicked, current, "a");
    clicked.finish(current);
    expect(clicked.getSnapshot()).toEqual({ active: null, release: null });
  });
});
