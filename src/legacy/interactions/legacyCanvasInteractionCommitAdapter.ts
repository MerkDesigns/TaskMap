import type {
  CanvasInteractionCommitPort,
  LayerDirection,
  MoveCommit,
  ResizeCommit,
} from "../../app/interactions/canvasInteractionTypes";
import type { TaskCanvas } from "../../types";
import { placeLegacyTextCardBundle } from "./legacyTextCardDrop";
import type { LegacyTextCardPlacementDecision } from "./legacyTextCardInteraction";

export interface LegacyCanvasCommitBindings {
  readonly getActiveCanvas: () => TaskCanvas;
  readonly commitActiveCanvas: (canvas: TaskCanvas) => void;
  readonly getContainerScrollOffset?: (containerId: string) => number;
  readonly getTextCardPlacementDecision?: () => LegacyTextCardPlacementDecision | null;
  readonly onTextCardPlacementCommitted?: (canvas: TaskCanvas) => void;
}

/**
 * Temporary production bridge. This is the only Phase 4 module allowed to
 * translate generic gesture completions into legacy TaskCanvas mutations.
 */
export function createLegacyCanvasInteractionCommitAdapter(
  bindings: LegacyCanvasCommitBindings,
): CanvasInteractionCommitPort {
  return {
    commitMove: (operation) => {
      const current = bindings.getActiveCanvas();
      const placement =
        operation.completionBehavior === "place"
          ? bindings.getTextCardPlacementDecision?.()
          : undefined;
      const next = applyMove(
        current,
        operation,
        bindings.getContainerScrollOffset ?? (() => 0),
        placement,
      );
      if (next !== current) {
        bindings.commitActiveCanvas(next);
        if (operation.completionBehavior === "place") {
          bindings.onTextCardPlacementCommitted?.(next);
        }
      }
    },
    commitResize: (operation) => {
      const current = bindings.getActiveCanvas();
      const next = applyResize(current, operation);
      if (next !== current) bindings.commitActiveCanvas(next);
    },
    commitLayerOrder: ({ selectedIds, direction }) => {
      const current = bindings.getActiveCanvas();
      const next = applyLayerOrder(current, new Set(selectedIds), direction);
      if (next !== current) bindings.commitActiveCanvas(next);
    },
  };
}

export function applyMove(
  canvas: TaskCanvas,
  operation: MoveCommit,
  getContainerScrollOffset: (containerId: string) => number = () => 0,
  placement?: LegacyTextCardPlacementDecision | null,
): TaskCanvas {
  const targets = new Map(operation.targets.map((target) => [target.id, target.to]));
  if (targets.size === 0) return canvas;
  let changed = false;
  const move = <T extends { id: string; x: number; y: number }>(items: readonly T[]): T[] =>
    items.map((item) => {
      const geometry = targets.get(item.id);
      if (!geometry || (item.x === geometry.x && item.y === geometry.y)) return item;
      changed = true;
      return { ...item, x: geometry.x, y: geometry.y };
    });
  const containers = move(canvas.containers);
  const textBlocks = move(canvas.textBlocks);
  let textCards = move(canvas.textCards);
  const images = move(canvas.images);
  const primaryCard = textCards.find((card) => card.id === operation.primaryId);
  if (
    primaryCard &&
    targets.has(primaryCard.id) &&
    operation.completionBehavior === "place" &&
    operation.screenDistance >= 3
  ) {
    textCards = placeLegacyTextCardBundle(
      canvas,
      textCards,
      targets,
      operation.pointerWorld,
      getContainerScrollOffset,
      placement,
    );
    changed = changed || textCards !== canvas.textCards;
  }
  return changed ? { ...canvas, containers, textBlocks, textCards, images } : canvas;
}

export function applyResize(canvas: TaskCanvas, operation: ResizeCommit): TaskCanvas {
  let changed = false;
  const resize = <T extends { id: string; width: number; height: number }>(
    items: readonly T[],
  ): T[] =>
    items.map((item) => {
      if (
        item.id !== operation.id ||
        (item.width === operation.to.width && item.height === operation.to.height)
      )
        return item;
      changed = true;
      return { ...item, width: operation.to.width, height: operation.to.height };
    });
  const containers = resize(canvas.containers);
  const textBlocks = resize(canvas.textBlocks);
  const images = resize(canvas.images);
  return changed ? { ...canvas, containers, textBlocks, images } : canvas;
}

export function applyLayerOrder(
  canvas: TaskCanvas,
  selectedIds: ReadonlySet<string>,
  direction: LayerDirection,
): TaskCanvas {
  const items = [
    ...canvas.containers,
    ...canvas.textBlocks,
    ...canvas.textCards.filter((card) => !card.containerId),
    ...canvas.images.filter((image) => !image.containerId),
  ].sort(
    (left, right) =>
      (left.layer ?? Number.MAX_SAFE_INTEGER) - (right.layer ?? Number.MAX_SAFE_INTEGER),
  );
  const selected = items.filter(({ id }) => selectedIds.has(id));
  if (selected.length === 0) return canvas;
  const without = items.filter(({ id }) => !selectedIds.has(id));
  const first = items.findIndex(({ id }) => selectedIds.has(id));
  let last = -1;
  for (let itemIndex = items.length - 1; itemIndex >= 0; itemIndex -= 1) {
    if (selectedIds.has(items[itemIndex].id)) {
      last = itemIndex;
      break;
    }
  }
  const before = items.slice(0, first).filter(({ id }) => !selectedIds.has(id)).length;
  const through = items.slice(0, last + 1).filter(({ id }) => !selectedIds.has(id)).length;
  const index =
    direction === "back"
      ? 0
      : direction === "front"
        ? without.length
        : direction === "backward"
          ? Math.max(0, before - 1)
          : Math.min(without.length, through + 1);
  const reordered = [...without];
  reordered.splice(index, 0, ...selected);
  if (reordered.every((item, itemIndex) => items[itemIndex]?.id === item.id)) return canvas;
  const layers = new Map(reordered.map(({ id }, itemIndex) => [id, itemIndex]));
  const apply = <T extends { id: string; layer?: number }>(values: readonly T[]): T[] =>
    values.map((value) =>
      layers.has(value.id) ? { ...value, layer: layers.get(value.id) } : value,
    );
  return {
    ...canvas,
    containers: apply(canvas.containers),
    textBlocks: apply(canvas.textBlocks),
    textCards: apply(canvas.textCards),
    images: apply(canvas.images),
  };
}
