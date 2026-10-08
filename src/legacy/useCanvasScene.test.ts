import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ContainerElement, TextCardElement } from "../types";
import { useCanvasScene } from "./useCanvasScene";

const box: ContainerElement = {
  id: "box",
  name: "Box",
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  accent: "#123456",
};
const card = (id: string, extra: Partial<TextCardElement> = {}): TextCardElement => ({
  id,
  text: id,
  x: 0,
  y: 0,
  accent: "#abcdef",
  ...extra,
});

const scene = () =>
  renderHook(() =>
    useCanvasScene({
      containers: [box],
      textBlocks: [],
      textCards: [
        card("node", { kind: "mindmap" }),
        card("plain"),
        card("inside", { containerId: "box" }),
      ],
      images: [],
      connections: [],
    }),
  ).result.current;

describe("useCanvasScene", () => {
  it("finds any element by id and keeps contained cards out of the loose list", () => {
    const current = scene();

    expect(current.element("box")).toBe(box);
    expect(current.looseCards.map(({ id }) => id)).toEqual(["node", "plain"]);
  });

  it("colours connection ports by element, and only for cards that can connect", () => {
    const current = scene();

    expect(current.portAccent("box")).toBe("#123456");
    expect(current.portAccent("node")).toBeDefined();
    expect(current.portAccent("plain")).toBeUndefined();
  });
});
