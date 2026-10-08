import { act, renderHook } from "@testing-library/react";
import type { WheelEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ContainerElement, TextCardElement } from "../types";
import { useContainerCardScroll } from "./useContainerCardScroll";

// 48 header + 17 padding; rows are 43 high with an 8 gap. Four rows need 230 px, the box shows 152.
const box: ContainerElement = {
  id: "box",
  name: "Box",
  x: 100,
  y: 0,
  width: 300,
  height: 200,
  accent: "#fff",
};
const cards: TextCardElement[] = [0, 1, 2, 3].map((order) => ({
  id: `card-${order}`,
  text: `Card ${order}`,
  x: 0,
  y: 0,
  accent: "#fff",
  containerId: "box",
  order,
}));
const loose: TextCardElement = { id: "loose", text: "Loose", x: 5, y: 6, accent: "#fff" };

const wheel = (deltaY: number) =>
  ({
    deltaY,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  }) as unknown as WheelEvent<HTMLElement>;

function setup(textCards = [...cards, loose]) {
  return renderHook(() =>
    useContainerCardScroll(textCards, (id) => (id === "box" ? box : undefined)),
  );
}

describe("useContainerCardScroll", () => {
  it("scrolls an overflowing container by the wheel, no further than its last row", () => {
    const { result } = setup();

    act(() => result.current.wheel(wheel(30), box));
    expect(result.current.offsets.box).toBe(30);
    act(() => result.current.wheel(wheel(500), box));
    expect(result.current.layout.scrollOffset(box)).toBe(78);
  });

  it("leaves the wheel to the canvas when the cards fit", () => {
    const { result } = setup(cards.slice(0, 1));
    const event = wheel(30);

    act(() => result.current.wheel(event, box));

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(result.current.offsets.box).toBeUndefined();
  });

  it("places cards in their scrolled row, and loose cards where they are", () => {
    const { result } = setup();
    act(() => result.current.scrollTo("box", 20));

    expect(result.current.restingPosition(cards[1])).toEqual({ x: 117, y: 65 + 51 - 20 });
    expect(result.current.restingPosition(loose)).toEqual({ x: 5, y: 6 });
  });

  it("scrolls containers back to their first card", () => {
    const { result } = setup();
    act(() => result.current.scrollTo("box", 50));

    act(() => result.current.reset(["box"]));

    expect(result.current.currentOffsets()).toEqual({ box: 0 });
  });
});
