import { original, type Draft } from "immer";
import { z } from "zod";
import { commandRejected, defineCommandHandler } from "../../domain/commands/commandHandler";
import { DOCUMENT_LIMITS } from "../../domain/document/documentLimits";
import { entityIdSchema } from "../../domain/document/documentSchema";
import type { TaskMapDocument } from "../../domain/document/documentTypes";
import type { CanvasId, ElementId } from "../../domain/ids/entityIds";
import { createRetainedCanvasProjection } from "../view-projection/createRetainedCanvasProjection";

const elementId = entityIdSchema("element");
const ids = z.array(elementId).max(DOCUMENT_LIMITS.elementCount);
const reject = () => [
  commandRejected("command.payload", "Layer targets or order are invalid or changed."),
];

export const reorderRetainedLayersCommand = defineCommandHandler({
  type: "document.elements.reorder-layers",
  label: "Reorder element layers",
  history: "record",
  payloadSchema: z
    .object({
      canvasId: entityIdSchema("canvas"),
      elementIds: ids,
      expectedRootOrder: ids,
      direction: z.enum(["back", "backward", "forward", "front"]),
    })
    .strict(),
  apply(document, payload) {
    const source = original(document as object) as TaskMapDocument;
    const roots = rootOrder(source, payload.canvasId);
    if (!roots || !sameOrder(roots, payload.expectedRootOrder)) return reject();
    const selectedIds = new Set(payload.elementIds);
    const rootIds = new Set(roots);
    if (
      selectedIds.size !== payload.elementIds.length ||
      payload.elementIds.some((id) => !rootIds.has(id))
    )
      return reject();
    // Retained group order comes from existing stacking, never selection/click order. Locks allow
    // layer operations. Child targets are filtered by the UI; reject them here, not silently drop them.
    const selected = roots.filter((id) => selectedIds.has(id));
    if (!selected.length) return;
    const without = roots.filter((id) => !selectedIds.has(id));
    const first = roots.indexOf(selected[0]);
    const last = roots.indexOf(selected[selected.length - 1]);
    const before = roots.slice(0, first).filter((id) => !selectedIds.has(id)).length;
    const through = roots.slice(0, last + 1).filter((id) => !selectedIds.has(id)).length;
    const index =
      payload.direction === "back"
        ? 0
        : payload.direction === "front"
          ? without.length
          : payload.direction === "backward"
            ? Math.max(0, before - 1)
            : Math.min(without.length, through + 1);
    without.splice(index, 0, ...selected);
    writeRootOrder(document, payload.canvasId, roots, without);
  },
});

// Keep the generic single-item API's absolute canvas index, but only allow root-to-root slots.
// It has no captured order precondition; deferred UI callbacks must use the group command instead.
export const reorderRetainedElementCommand = defineCommandHandler({
  type: "document.element.reorder",
  label: "Reorder element",
  history: "record",
  payloadSchema: z
    .object({ elementId, toIndex: z.number().int().min(0).max(DOCUMENT_LIMITS.elementCount) })
    .strict(),
  apply(document, payload) {
    const source = original(document as object) as TaskMapDocument;
    const element = source.elements[payload.elementId];
    if (!element) return reject();
    const roots = rootOrder(source, element.canvasId);
    if (!roots) return reject();
    const from = roots.indexOf(element.id);
    const target = source.canvases[element.canvasId].elementOrder[payload.toIndex];
    const to = roots.indexOf(target);
    if (from < 0 || to < 0) return reject();
    const next = [...roots];
    next.splice(from, 1);
    next.splice(to, 0, element.id);
    writeRootOrder(document, element.canvasId, roots, next);
  },
});

function rootOrder(document: TaskMapDocument, canvasId: CanvasId): ElementId[] | null {
  const projection = createRetainedCanvasProjection();
  try {
    const result = projection.project(document);
    if (!result.ok) return null;
    const canvas = result.canvases.find(({ id }) => id === canvasId);
    if (!canvas) return null;
    const roots = new Set(
      [
        ...canvas.containers,
        ...canvas.textBlocks,
        ...canvas.textCards.filter((card) => !card.containerId),
        ...canvas.images.filter((image) => !image.containerId),
      ].map(({ id }) => id),
    );
    return document.canvases[canvasId].elementOrder.filter((id) => roots.has(id));
  } finally {
    projection.clear();
  }
}

function writeRootOrder(
  document: Draft<TaskMapDocument>,
  canvasId: CanvasId,
  before: readonly ElementId[],
  next: readonly ElementId[],
) {
  if (sameOrder(before, next)) return;
  const rootIds = new Set(before);
  const order = document.canvases[canvasId].elementOrder;
  let index = 0;
  // The canonical array includes children. Permute ONLY its root slots: contained element layer
  // positions and child-owned placement remain untouched while the projected root stack changes.
  for (let slot = 0; slot < order.length; slot++) {
    if (rootIds.has(order[slot])) order[slot] = next[index++];
  }
}

function sameOrder(left: readonly ElementId[], right: readonly ElementId[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}
