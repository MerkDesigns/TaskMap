import type { ContainerPlacement } from "../../domain/document/elementPlacement";
import type { ElementId } from "../../domain/ids/entityIds";

// Structural output of the existing text-card placement service. No DOM or legacy model dependency.
export interface ResolvedTextCardDrop {
  readonly draggedIds: readonly string[];
  readonly targetContainerId: string | null;
  readonly realIndex: number | null;
  readonly loosePositions: readonly {
    readonly id: string;
    readonly x: number;
    readonly y: number;
  }[];
}
export interface CapturedPlacementChild {
  readonly elementId: ElementId;
  readonly type: "text-card" | "image";
  readonly placement: ContainerPlacement;
}

export function resolveRetainedTextCardDrop(
  children: readonly CapturedPlacementChild[],
  movingIds: readonly ElementId[],
  decision: ResolvedTextCardDrop,
) {
  const types = new Map(children.map((child) => [child.elementId, child.type]));
  if (
    !movingIds.length ||
    decision.draggedIds.length !== movingIds.length ||
    decision.draggedIds.some((id, index) => id !== movingIds[index]) ||
    movingIds.some((id) => types.get(id) !== "text-card")
  )
    throw new Error("Invalid drop members");
  const moving = new Set<string>(movingIds);
  const positions = new Map(decision.loosePositions.map((position) => [position.id, position]));
  if (
    positions.size !== moving.size ||
    positions.size !== decision.loosePositions.length ||
    decision.loosePositions.some(
      (position) =>
        !moving.has(position.id) || !Number.isFinite(position.x) || !Number.isFinite(position.y),
    )
  )
    throw new Error("Invalid drop positions");
  if (decision.targetContainerId === null) {
    if (decision.realIndex !== null) throw new Error("Invalid root drop");
    return { target: null, positions };
  }
  const siblings = children
    .filter(
      (child) =>
        child.placement?.containerId === decision.targetContainerId && !moving.has(child.elementId),
    )
    .sort((a, b) => a.placement!.order - b.placement!.order);
  const cards = siblings.filter((child) => child.type === "text-card");
  const cardIndex = decision.realIndex;
  if (
    cardIndex === null ||
    !Number.isInteger(cardIndex) ||
    cardIndex < 0 ||
    cardIndex > cards.length
  )
    throw new Error("Invalid drop index");
  // A card-only slot before a card maps to that card's full-list slot. End-of-card-list appends
  // after all children, including trailing images. Existing image/card relative order is preserved.
  const index = cardIndex === cards.length ? siblings.length : siblings.indexOf(cards[cardIndex]);
  return { target: { containerId: decision.targetContainerId as ElementId, index }, positions };
}
