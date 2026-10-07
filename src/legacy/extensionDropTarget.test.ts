// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { ContainerElement, ImageElement, TextBlockElement, TextCardElement } from "../types";
import {
  extensionDropTargetIds,
  findExtensionDropTarget,
  type ExtensionDropScene,
  type ExtensionDropTargetType,
} from "./extensionDropTarget";

const box = { x: 0, y: 0, width: 200, height: 200, accent: "#fff" };
const container: ContainerElement = { ...box, id: "box", name: "Box" };
const block: TextBlockElement = { ...box, id: "block", name: "Block", text: "" };
const image: ImageElement = { ...box, id: "image" };
const card = (id: string, kind?: TextCardElement["kind"]): TextCardElement => ({
  id,
  kind,
  text: id,
  x: 10,
  y: 10,
  accent: "#fff",
});
const cardBox = { left: 10, top: 10, width: 100, height: 40 };

function scene(
  compatibleTypes: ExtensionDropTargetType[],
  overrides: Partial<ExtensionDropScene> = {},
): ExtensionDropScene {
  return {
    images: [],
    looseCards: [],
    containers: [],
    textBlocks: [],
    compatible: (type) => compatibleTypes.includes(type),
    cardBounds: () => cardBox,
    looseCardFallbackBounds: () => cardBox,
    containerCardSlots: () => [],
    ...overrides,
  };
}

describe("findExtensionDropTarget", () => {
  it("lands on the topmost compatible element in image, card, block, container order", () => {
    const everything = {
      images: [image],
      looseCards: [card("card")],
      textBlocks: [block],
      containers: [container],
    };
    const point = { x: 20, y: 20 };

    expect(
      findExtensionDropTarget(point, scene(["image", "text-card"], everything))?.target,
    ).toEqual({ type: "image", id: "image" });
    expect(findExtensionDropTarget(point, scene(["text-card"], everything))?.target).toEqual({
      type: "text-card",
      id: "card",
    });
    expect(findExtensionDropTarget(point, scene(["container"], everything))?.target).toEqual({
      type: "container",
      id: "box",
    });
  });

  it("skips loose cards the extension does not fit, such as mind-map nodes", () => {
    const hit = findExtensionDropTarget(
      { x: 20, y: 20 },
      scene(["text-card", "container"], {
        looseCards: [card("plain"), card("node", "mindmap")],
        containers: [container],
      }),
    );

    expect(hit?.target).toEqual({ type: "text-card", id: "plain" });
  });

  it("finds a card inside a container only where its row is visible", () => {
    const slot = {
      card: card("inside"),
      left: 10,
      top: 180,
      width: 100,
      height: 40,
      visibleTop: 50,
      visibleBottom: 200,
    };
    const withSlot = scene(["text-card", "container"], {
      containers: [container],
      containerCardSlots: () => [slot],
    });

    expect(findExtensionDropTarget({ x: 20, y: 190 }, withSlot)?.target.id).toBe("inside");
    // Below the container's visible content the row is clipped, so the drop lands on the container.
    expect(findExtensionDropTarget({ x: 20, y: 210 }, withSlot)).toBeNull();
    expect(findExtensionDropTarget({ x: 150, y: 150 }, withSlot)?.target.id).toBe("box");
  });

  it("lands nowhere when the card under the pointer cannot be measured", () => {
    const hit = findExtensionDropTarget(
      { x: 20, y: 20 },
      scene(["text-card", "container"], {
        looseCards: [card("hidden")],
        containers: [container],
        cardBounds: () => null,
      }),
    );

    expect(hit).toBeNull();
  });
});

describe("extensionDropTargetIds", () => {
  it("installs on the compatible part of a multi-selection the target is in", () => {
    const target = { type: "container" as const, id: "a" };
    const fits = (id: string) => id !== "image";

    expect(extensionDropTargetIds(target, ["a", "b", "image"], fits)).toEqual(["a", "b"]);
    expect(extensionDropTargetIds(target, ["b", "c"], fits)).toEqual(["a"]);
    expect(extensionDropTargetIds(target, ["a"], fits)).toEqual(["a"]);
  });
});
