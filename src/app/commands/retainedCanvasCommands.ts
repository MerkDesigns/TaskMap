import { z } from "zod";
import { original } from "immer";
import type { TaskMapDocument } from "../../domain/document/documentTypes";
import { canvasCommandHandlers } from "../../domain/commands/core/canvasCommands";
import {
  defineCommandHandler,
  commandRejected,
  type DomainCommandHandler,
} from "../../domain/commands/commandHandler";
import { canvasRecordSchema, entityIdSchema } from "../../domain/document/documentSchema";
import { constrainCanvasElement } from "../canvasElementConstraints";

const core = (type: string) => canvasCommandHandlers.find((handler) => handler.type === type)!;
const create = core("document.canvas.create");
const remove = core("document.canvas.remove");
const settings = core("document.canvas.update-settings");
export const retainedCanvasCommandHandlers: readonly DomainCommandHandler[] = [
  {
    ...create,
    apply(document, payload) {
      const issues = create.apply(document, payload);
      if (issues?.length) return issues;
      document.activeCanvasId = z
        .object({ canvas: canvasRecordSchema.omit({ elementOrder: true }) })
        .parse(payload).canvas.id;
    },
  },
  {
    ...remove,
    apply(document, payload) {
      if (document.canvasOrder.length <= 1)
        return [commandRejected("command.payload", "The last canvas cannot be removed.")];
      const { canvasId } = z.object({ canvasId: entityIdSchema("canvas") }).parse(payload);
      const index = document.canvasOrder.indexOf(canvasId);
      const nextActive =
        document.activeCanvasId === canvasId
          ? document.canvasOrder[Math.max(0, index - 1)]
          : document.activeCanvasId;
      const issues = remove.apply(document, payload);
      if (issues?.length) return issues;
      // Removing the first canvas chooses the first survivor; otherwise choose the previous canvas.
      if (nextActive !== canvasId) document.activeCanvasId = nextActive;
    },
  },
  {
    ...settings,
    apply(document, payload) {
      const parsed = z
        .object({ canvasId: entityIdSchema("canvas"), settings: canvasRecordSchema.shape.settings })
        .parse(payload);
      const before = original(document as object) as TaskMapDocument;
      const issues = settings.apply(document, payload);
      if (issues?.length) return issues;
      const { width, height } = parsed.settings;
      for (const id of before.canvases[parsed.canvasId].elementOrder) {
        const element = before.elements[id];
        const geometry = constrainCanvasElement(
          element.geometry,
          width,
          height,
          element.type === "text-card" || element.type === "mind-map-node",
        );
        Object.assign(document.elements[id].geometry, geometry);
      }
    },
  },
  defineCommandHandler({
    type: "document.canvas.clear",
    label: "Clear canvas",
    history: "record",
    payloadSchema: z.object({ canvasId: entityIdSchema("canvas") }).strict(),
    apply(document, { canvasId }) {
      const canvas = document.canvases[canvasId];
      if (!canvas) return [commandRejected("command.payload", "Canvas no longer exists.")];
      const removed = new Set(canvas.elementOrder);
      if (!removed.size) return;
      // Explicit confirmed Clear bypasses element locks, as the retained destructive action does.
      for (const id of removed) delete document.elements[id];
      for (const edge of Object.values(document.connections))
        if (edge.canvasId === canvasId) delete document.connections[edge.id];
      for (const installation of Object.values(document.extensionInstallations)) {
        if (installation.target.kind === "element" && removed.has(installation.target.elementId))
          delete document.extensionInstallations[installation.id];
      }
      canvas.elementOrder = [];
    },
  }),
  defineCommandHandler({
    type: "document.canvas.edit-details",
    label: "Edit canvas",
    history: "record",
    payloadSchema: z
      .object({
        canvasId: entityIdSchema("canvas"),
        name: canvasRecordSchema.shape.name,
        settings: canvasRecordSchema.shape.settings,
      })
      .strict(),
    apply(document, payload) {
      const handler = retainedCanvasCommandHandlers.find(
        ({ type }) => type === "document.canvas.update-settings",
      )!;
      const issues = handler.apply(document, {
        canvasId: payload.canvasId,
        settings: payload.settings,
      });
      if (issues?.length) return issues;
      document.canvases[payload.canvasId].name = payload.name;
    },
  }),
];
