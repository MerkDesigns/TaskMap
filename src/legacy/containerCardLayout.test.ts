// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { ContainerElement, TextCardElement } from "../types";
import {
  containerCardStackTop,
  createContainerCardLayout,
  groupContainerCards,
} from "./containerCardLayout";

// 48 header + 17 padding; rows are 43 high with an 8 gap.
const box: ContainerElement = {
  id: "box",
  name: "Box",
  x: 100,
  y: 0,
  width: 300,
  height: 200,
  accent: "#fff",
};
const card = (id: string, order: number, text = id): TextCardElement => ({
  id,
  text,
  x: 0,
  y: 0,
  accent: "#fff",
  containerId: "box",
  order,
});
const cards = [card("c", 2), card("a", 0, "Apples"), card("b", 1, "Bread"), card("d", 3)];

const layoutFor = (scroll = 0, container = box) => ({
  layout: createContainerCardLayout(cards, groupContainerCards(cards), { [container.id]: scroll }),
  container,
});

describe("container card layout", () => {
  it("orders a container's cards and shows only those matching its search", () => {
    const { layout } = layoutFor();
    const searching = { ...box, extensions: { search: { query: " BREAD " } } };

    expect(layout.ordered("box").map(({ id }) => id)).toEqual(["a", "b", "c", "d"]);
    expect(layout.visible(searching).map(({ id }) => id)).toEqual(["b"]);
    // The search row pushes the first row down.
    expect(containerCardStackTop(searching) - containerCardStackTop(box)).toBe(42);
  });

  it("scrolls only as far as the rows overflow the container", () => {
    // Four rows need 17 + 4·43 + 3·8 + 17 = 230 px; the box shows 200 − 48 = 152.
    expect(layoutFor().layout.maxScroll(box)).toBe(78);
    expect(layoutFor(500).layout.scrollOffset(box)).toBe(78);
    expect(layoutFor(-5).layout.scrollOffset(box)).toBe(0);
  });

  it("places rows from the top of the container, moved by its scroll", () => {
    const { layout } = layoutFor(20);

    expect(layout.rowPosition(box, 2)).toEqual({ x: 117, y: 65 + 2 * 51 - 20 });
    expect(layout.cardPosition(box, cards[0])).toEqual(layout.rowPosition(box, 2));
  });

  it("scrolls just enough to reveal a row", () => {
    const { layout } = layoutFor(0);

    expect(layout.revealOffset(box, 0, cards)).toBe(0);
    // Row 3 ends at 17 + 3·51 + 43 = 213, below the 152 px view (less padding).
    expect(layout.revealOffset(box, 3, cards)).toBe(78);
    expect(layoutFor(78).layout.revealOffset(box, 0, cards)).toBe(0);
  });

  it("drops a card into the row whose midpoint it is above", () => {
    const { layout } = layoutFor();
    // Without the dragged card "a", rows b, c, d have midpoints at 86.5, 137.5 and 188.5.
    expect(layout.dropIndex(box, { x: 0, y: 80 }, cards, "a")).toBe(0);
    expect(layout.dropIndex(box, { x: 0, y: 120 }, cards, "a")).toBe(1);
    expect(layout.dropIndex(box, { x: 0, y: 400 }, cards, "a")).toBe(3);
  });

  it("moves a held drop at most one row from where it is", () => {
    const { layout } = layoutFor();

    expect(layout.dropIndex(box, { x: 0, y: 400 }, cards, "a", 1)).toBe(2);
    expect(layout.dropIndex(box, { x: 0, y: 0 }, cards, "a", 2)).toBe(1);
    expect(layout.dropIndex(box, { x: 0, y: 140 }, cards, "a", 1)).toBe(1);
  });
});
