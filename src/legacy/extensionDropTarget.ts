import type { ContainerElement, ImageElement, TextBlockElement, TextCardElement } from "../types";

type Point = { readonly x: number; readonly y: number };

/** The element kinds an extension can be dropped on. */
export type ExtensionDropTargetType =
  "container" | "text-block" | "text-card" | "mindmap" | "image";
export interface ExtensionDropTarget {
  readonly type: ExtensionDropTargetType;
  readonly id: string;
}

/** A canvas-space rectangle with the corner radii a drop ripple is clipped to. */
export interface DropBounds {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly borderRadius?: number;
  readonly borderTopLeftRadius?: number;
  readonly borderTopRightRadius?: number;
  readonly borderBottomRightRadius?: number;
  readonly borderBottomLeftRadius?: number;
}

/** A card row inside a container, with the part of the container it can show in. */
export interface ContainerCardSlot {
  readonly card: TextCardElement;
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly visibleTop: number;
  readonly visibleBottom: number;
}

/** What a drop can land on, topmost last in every list, and how the canvas measures it. */
export interface ExtensionDropScene {
  readonly images: readonly ImageElement[];
  readonly looseCards: readonly TextCardElement[];
  readonly containers: readonly ContainerElement[];
  readonly textBlocks: readonly TextBlockElement[];
  readonly compatible: (type: ExtensionDropTargetType) => boolean;
  /** A card's shown bounds, or null when it is not visible (e.g. scrolled out of its container). */
  readonly cardBounds: (card: TextCardElement) => DropBounds | null;
  /** A loose card's estimated bounds, for hit testing before it has been measured. */
  readonly looseCardFallbackBounds: (card: TextCardElement) => DropBounds;
  /** A container's visible card rows, topmost last. */
  readonly containerCardSlots: (container: ContainerElement) => readonly ContainerCardSlot[];
}

export interface ExtensionDropHit {
  readonly target: ExtensionDropTarget;
  readonly bounds: DropBounds;
}

const contains = (bounds: DropBounds, point: Point) =>
  point.x >= bounds.left &&
  point.x <= bounds.left + bounds.width &&
  point.y >= bounds.top &&
  point.y <= bounds.top + bounds.height;

const boxOf = (element: { x: number; y: number; width: number; height: number }): DropBounds => ({
  left: element.x,
  top: element.y,
  width: element.width,
  height: element.height,
});

function topmost<Element>(elements: readonly Element[], hit: (element: Element) => boolean) {
  for (let index = elements.length - 1; index >= 0; index -= 1) {
    if (hit(elements[index])) return elements[index];
  }
  return undefined;
}

/**
 * The element an extension dropped at `point` lands on: an image, then a loose card or mind-map
 * node, then a card in a container, then a text block, then a container, each only when the
 * extension fits that kind. A hit on a card that cannot be measured lands nowhere rather than
 * falling through to what is behind it.
 */
export function findExtensionDropTarget(
  point: Point,
  scene: ExtensionDropScene,
): ExtensionDropHit | null {
  if (scene.compatible("image")) {
    const image = topmost(scene.images, (candidate) => contains(boxOf(candidate), point));
    if (image) return { target: { type: "image", id: image.id }, bounds: boxOf(image) };
  }

  if (scene.compatible("text-card") || scene.compatible("mindmap")) {
    const cardType = (card: TextCardElement) => (card.kind === "mindmap" ? "mindmap" : "text-card");
    const looseCard = topmost(
      scene.looseCards,
      (card) =>
        scene.compatible(cardType(card)) &&
        contains(scene.cardBounds(card) ?? scene.looseCardFallbackBounds(card), point),
    );
    if (looseCard) {
      const bounds = scene.cardBounds(looseCard);
      return bounds ? { target: { type: cardType(looseCard), id: looseCard.id }, bounds } : null;
    }

    for (let index = scene.containers.length - 1; index >= 0; index -= 1) {
      const slot = topmost(
        scene.containerCardSlots(scene.containers[index]),
        ({ left, top, width, height, visibleTop, visibleBottom }) =>
          top < visibleBottom &&
          top + height > visibleTop &&
          point.x >= left &&
          point.x <= left + width &&
          point.y >= Math.max(top, visibleTop) &&
          point.y <= Math.min(top + height, visibleBottom),
      );
      if (slot) {
        const bounds = scene.cardBounds(slot.card);
        return bounds ? { target: { type: "text-card", id: slot.card.id }, bounds } : null;
      }
    }
  }

  if (scene.compatible("text-block")) {
    const block = topmost(scene.textBlocks, (candidate) => contains(boxOf(candidate), point));
    if (block) return { target: { type: "text-block", id: block.id }, bounds: boxOf(block) };
  }

  const container = topmost(scene.containers, (candidate) => contains(boxOf(candidate), point));
  return container && scene.compatible("container")
    ? { target: { type: "container", id: container.id }, bounds: boxOf(container) }
    : null;
}

/**
 * The elements a drop installs on: the target, or every compatible element of the selection when
 * the target is part of a multi-selection.
 */
export function extensionDropTargetIds(
  target: ExtensionDropTarget,
  selection: readonly string[],
  compatibleElement: (id: string) => boolean,
): string[] {
  if (selection.length <= 1 || !selection.includes(target.id)) return [target.id];
  return selection.filter(compatibleElement);
}
