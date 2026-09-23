import { original } from "immer";
import { z } from "zod";
import { commandRejected, defineCommandHandler } from "../../domain/commands/commandHandler";
import {
  elementGeometriesUpdateSchema,
  updateElementGeometriesCommand,
} from "../../domain/commands/core/elementGeometryCommands";
import { elementGeometrySchema, entityIdSchema } from "../../domain/document/documentSchema";
import type { TaskMapDocument } from "../../domain/document/documentTypes";
import { createRetainedCanvasProjection } from "../view-projection/createRetainedCanvasProjection";

// The generic transaction still owns canonical-from checks, duplicate detection, atomic writes and
// no-op suppression. This product replacement adds retained lock and resize capabilities only.
export const updateRetainedGeometriesCommand = defineCommandHandler({
  type: "document.elements.update-geometry",
  label: "Update element geometry",
  history: "record",
  payloadSchema: elementGeometriesUpdateSchema,
  apply(document, payload) {
    const projection = createRetainedCanvasProjection();
    try {
      const result = projection.project(original(document as object) as TaskMapDocument);
      if (!result.ok)
        return [commandRejected("document", "Geometry edits require valid retained feature data.")];
      const canvas = result.canvases.find(({ id }) => id === payload.canvasId);
      if (!canvas)
        return [commandRejected("command.payload", "The geometry canvas does not exist.")];
      const resizable = [...canvas.containers, ...canvas.textBlocks, ...canvas.images];
      const resizableIds = new Set(resizable.map(({ id }) => id));
      const views = new Map([...resizable, ...canvas.textCards].map((view) => [view.id, view]));
      for (const { elementId, to } of payload.updates) {
        const view = views.get(elementId);
        if (!view)
          return [
            commandRejected("command.payload.updates", "An element is not in the target canvas."),
          ];
        const current = document.elements[elementId].geometry;
        const resized = current.width !== to.width || current.height !== to.height;
        const translated = current.x !== to.x || current.y !== to.y;
        if ((resized || translated) && view.extensions?.lock?.enabled) {
          return [
            commandRejected(
              "command.payload.updates",
              "An element became locked before completion.",
            ),
          ];
        }
        if (resized && !resizableIds.has(elementId)) {
          return [
            commandRejected("command.payload.updates", "Content-sized elements cannot be resized."),
          ];
        }
      }
      // The controller filters locked members at gesture start. A newly locked completed target
      // rejects the whole transaction instead of applying a distorted subset of the preview.
      return updateElementGeometriesCommand.apply(document, payload);
    } finally {
      projection.clear();
    }
  },
});

// Single geometry edits share the same feature policy; this legacy-shaped command has no supplied
// expected-from snapshot. Gesture callbacks must use the group command's captured canonical values.
export const updateRetainedGeometryCommand = defineCommandHandler({
  type: "document.element.update-geometry",
  label: "Update element geometry",
  history: "record",
  payloadSchema: z
    .object({ elementId: entityIdSchema("element"), geometry: elementGeometrySchema })
    .strict(),
  apply(document, payload) {
    const element = document.elements[payload.elementId];
    if (!element)
      return [commandRejected("command.payload", "The geometry target does not exist.")];
    return updateRetainedGeometriesCommand.apply(document, {
      canvasId: element.canvasId,
      updates: [{ elementId: element.id, from: element.geometry, to: payload.geometry }],
    });
  },
});
