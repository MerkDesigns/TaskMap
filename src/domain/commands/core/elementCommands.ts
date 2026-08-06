import { castDraft } from "immer";
import { z } from "zod";
import { DOCUMENT_LIMITS } from "../../document/documentLimits";
import {
  documentElementSchema,
  elementGeometrySchema,
  entityIdSchema,
  jsonObjectSchema,
} from "../../document/documentSchema";
import type { DomainCommandHandler } from "../commandHandler";
import { commandRejected, defineCommandHandler } from "../commandHandler";

const elementId = entityIdSchema("element");
const elementReference = z.object({ elementId }).strict();

export const elementCommandHandlers = [
  defineCommandHandler({
    type: "document.element.insert",
    label: "Insert element",
    history: "record",
    payloadSchema: z
      .object({
        element: documentElementSchema,
        index: z.number().int().min(0).max(DOCUMENT_LIMITS.elementCount).optional(),
      })
      .strict(),
    apply(document, payload) {
      const element = payload.element;
      if (document.elements[element.id] !== undefined) {
        return [commandRejected("command.payload.element.id", "Element ID already exists")];
      }
      const canvas = document.canvases[element.canvasId];
      if (canvas === undefined) {
        return [commandRejected("command.payload.element.canvasId", "Canvas does not exist")];
      }
      const index = payload.index ?? canvas.elementOrder.length;
      if (index > canvas.elementOrder.length) {
        return [commandRejected("command.payload.index", "Element index is out of range")];
      }
      document.elements[element.id] = castDraft(element);
      canvas.elementOrder.splice(index, 0, element.id);
    },
  }),
  defineCommandHandler({
    type: "document.element.update-geometry",
    label: "Update element geometry",
    history: "record",
    payloadSchema: z.object({ elementId, geometry: elementGeometrySchema }).strict(),
    apply(document, payload) {
      const element = document.elements[payload.elementId];
      if (element === undefined) return missingElement(payload.elementId);
      element.geometry = payload.geometry;
    },
  }),
  defineCommandHandler({
    type: "document.element.replace-data",
    label: "Update element data",
    history: "record",
    payloadSchema: z.object({ elementId, data: jsonObjectSchema }).strict(),
    apply(document, payload) {
      const element = document.elements[payload.elementId];
      if (element === undefined) return missingElement(payload.elementId);
      Object.assign(element, { data: payload.data });
    },
  }),
  defineCommandHandler({
    type: "document.element.reorder",
    label: "Reorder element",
    history: "record",
    payloadSchema: z
      .object({ elementId, toIndex: z.number().int().min(0).max(DOCUMENT_LIMITS.elementCount) })
      .strict(),
    apply(document, payload) {
      const element = document.elements[payload.elementId];
      if (element === undefined) return missingElement(payload.elementId);
      const order = document.canvases[element.canvasId]?.elementOrder;
      if (order === undefined) {
        return [commandRejected("command.payload.elementId", "Element canvas does not exist")];
      }
      if (payload.toIndex >= order.length) {
        return [commandRejected("command.payload.toIndex", "Element index is out of range")];
      }
      const currentIndex = order.indexOf(payload.elementId);
      if (currentIndex < 0) {
        return [commandRejected("command.payload.elementId", "Element is absent from layer order")];
      }
      order.splice(currentIndex, 1);
      order.splice(payload.toIndex, 0, payload.elementId);
    },
  }),
  defineCommandHandler({
    type: "document.element.remove",
    label: "Remove element",
    history: "record",
    payloadSchema: elementReference,
    apply(document, payload) {
      const element = document.elements[payload.elementId];
      if (element === undefined) return missingElement(payload.elementId);
      const order = document.canvases[element.canvasId].elementOrder;
      order.splice(order.indexOf(payload.elementId), 1);
      delete document.elements[payload.elementId];
      for (const connection of Object.values(document.connections)) {
        if (
          connection.source.elementId === payload.elementId ||
          connection.target.elementId === payload.elementId
        ) {
          delete document.connections[connection.id];
        }
      }
      for (const installation of Object.values(document.extensionInstallations)) {
        if (
          installation.target.kind === "element" &&
          installation.target.elementId === payload.elementId
        ) {
          delete document.extensionInstallations[installation.id];
        }
      }
    },
  }),
] as const satisfies readonly DomainCommandHandler[];

function missingElement(id: string) {
  return [commandRejected("command.payload.elementId", `Element ${id} does not exist`)];
}
