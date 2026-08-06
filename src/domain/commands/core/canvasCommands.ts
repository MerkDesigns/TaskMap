import { z } from "zod";
import { DOCUMENT_LIMITS } from "../../document/documentLimits";
import { canvasRecordSchema, entityIdSchema } from "../../document/documentSchema";
import type { DomainCommandHandler } from "../commandHandler";
import { commandRejected, defineCommandHandler } from "../commandHandler";

const canvasId = entityIdSchema("canvas");
const createPayload = z
  .object({
    canvas: canvasRecordSchema.omit({ elementOrder: true }),
    index: z.number().int().min(0).max(DOCUMENT_LIMITS.canvasCount).optional(),
  })
  .strict();
const canvasReference = z.object({ canvasId }).strict();

export const canvasCommandHandlers = [
  defineCommandHandler({
    type: "document.canvas.create",
    label: "Create canvas",
    history: "record",
    payloadSchema: createPayload,
    apply(document, payload) {
      if (document.canvases[payload.canvas.id] !== undefined) {
        return [commandRejected("command.payload.canvas.id", "Canvas ID already exists")];
      }
      const index = payload.index ?? document.canvasOrder.length;
      if (index > document.canvasOrder.length) {
        return [commandRejected("command.payload.index", "Canvas index is out of range")];
      }
      document.canvases[payload.canvas.id] = { ...payload.canvas, elementOrder: [] };
      document.canvasOrder.splice(index, 0, payload.canvas.id);
      if (document.activeCanvasId === null) document.activeCanvasId = payload.canvas.id;
    },
  }),
  defineCommandHandler({
    type: "document.canvas.rename",
    label: "Rename canvas",
    history: "record",
    payloadSchema: z.object({ canvasId, name: canvasRecordSchema.shape.name }).strict(),
    apply(document, payload) {
      const canvas = document.canvases[payload.canvasId];
      if (canvas === undefined) return missingCanvas(payload.canvasId);
      canvas.name = payload.name;
    },
  }),
  defineCommandHandler({
    type: "document.canvas.update-settings",
    label: "Update canvas settings",
    history: "record",
    payloadSchema: z.object({ canvasId, settings: canvasRecordSchema.shape.settings }).strict(),
    apply(document, payload) {
      const canvas = document.canvases[payload.canvasId];
      if (canvas === undefined) return missingCanvas(payload.canvasId);
      canvas.settings = payload.settings;
    },
  }),
  defineCommandHandler({
    type: "document.canvas.set-active",
    label: "Set active canvas",
    history: "ignore",
    payloadSchema: canvasReference,
    apply(document, payload) {
      if (document.canvases[payload.canvasId] === undefined) return missingCanvas(payload.canvasId);
      document.activeCanvasId = payload.canvasId;
    },
  }),
  defineCommandHandler({
    type: "document.canvas.reorder",
    label: "Reorder canvases",
    history: "record",
    payloadSchema: z.object({ order: z.array(canvasId).max(DOCUMENT_LIMITS.canvasCount) }).strict(),
    apply(document, payload) {
      if (!isCompleteOrder(payload.order, Object.keys(document.canvases))) {
        return [
          commandRejected(
            "command.payload.order",
            "Canvas order must contain every canvas exactly once",
          ),
        ];
      }
      document.canvasOrder = payload.order;
    },
  }),
  defineCommandHandler({
    type: "document.canvas.remove",
    label: "Remove canvas",
    history: "record",
    payloadSchema: canvasReference,
    apply(document, payload) {
      const canvas = document.canvases[payload.canvasId];
      if (canvas === undefined) return missingCanvas(payload.canvasId);
      const removedElements = new Set(canvas.elementOrder);
      for (const elementId of removedElements) delete document.elements[elementId];
      for (const connection of Object.values(document.connections)) {
        if (
          connection.canvasId === payload.canvasId ||
          removedElements.has(connection.source.elementId) ||
          removedElements.has(connection.target.elementId)
        ) {
          delete document.connections[connection.id];
        }
      }
      for (const installation of Object.values(document.extensionInstallations)) {
        const target = installation.target;
        if (
          (target.kind === "canvas" && target.canvasId === payload.canvasId) ||
          (target.kind === "element" && removedElements.has(target.elementId))
        ) {
          delete document.extensionInstallations[installation.id];
        }
      }
      const removedIndex = document.canvasOrder.indexOf(payload.canvasId);
      document.canvasOrder.splice(removedIndex, 1);
      delete document.canvases[payload.canvasId];
      if (document.activeCanvasId === payload.canvasId) {
        document.activeCanvasId =
          document.canvasOrder[Math.min(removedIndex, document.canvasOrder.length - 1)] ?? null;
      }
    },
  }),
] as const satisfies readonly DomainCommandHandler[];

function missingCanvas(canvasId: string) {
  return [commandRejected("command.payload.canvasId", `Canvas ${canvasId} does not exist`)];
}

function isCompleteOrder(order: readonly string[], expected: readonly string[]): boolean {
  if (order.length !== expected.length || new Set(order).size !== order.length) return false;
  const expectedIds = new Set(expected);
  return order.every((id) => expectedIds.has(id));
}
