import { z } from "zod";
import { original } from "immer";
import type { TaskMapDocument } from "../../domain/document/documentTypes";
import { commandRejected, defineCommandHandler } from "../../domain/commands/commandHandler";
import { DOCUMENT_LIMITS } from "../../domain/document/documentLimits";
import { entityIdSchema } from "../../domain/document/documentSchema";
import type { ElementId } from "../../domain/ids/entityIds";
import { createRetainedCanvasProjection } from "../view-projection/createRetainedCanvasProjection";

const elementId = entityIdSchema("element");

// Application-level coordination of retained feature relationships; no legacy collection setters,
// timers, media-byte deletion, selection mutation or renderer ownership.
export const deleteRetainedSelectionCommand = defineCommandHandler({
  type: "document.selection.delete",
  label: "Delete selection",
  history: "record",
  payloadSchema: z
    .object({
      canvasId: entityIdSchema("canvas"),
      elementIds: z.array(elementId).max(DOCUMENT_LIMITS.elementCount),
    })
    .strict(),
  apply(document, payload) {
    const selected = new Set(payload.elementIds);
    if (
      selected.size !== payload.elementIds.length ||
      !document.canvases[payload.canvasId] ||
      payload.elementIds.some((id) => document.elements[id]?.canvasId !== payload.canvasId)
    ) {
      return [
        commandRejected(
          "command.payload",
          "Deletion targets must be unique existing elements in the supplied canvas.",
        ),
      ];
    }
    const projection = createRetainedCanvasProjection();
    try {
      // Plan against the immutable transaction input, not Immer's recursive-JSON proxy types.
      const result = projection.project(original(document as object) as TaskMapDocument);
      if (!result.ok)
        return [commandRejected("document", "Deletion requires valid retained feature data.")];
      const canvas = result.canvases.find(({ id }) => id === payload.canvasId)!;
      const children = [...canvas.textCards, ...canvas.images];
      const all = [...canvas.containers, ...canvas.textBlocks, ...children];
      const locked = new Set(
        all.filter((element) => element.extensions?.lock?.enabled).map(({ id }) => id),
      );
      const protectedContainers = new Set(
        children
          .filter((child) => locked.has(child.id) && child.containerId)
          .map((child) => child.containerId),
      );
      const mayDelete = (id: string) =>
        document.documentSettings.allowLockedElementDeletion ||
        (!locked.has(id) && !protectedContainers.has(id));
      const removed = new Set<ElementId>(payload.elementIds.filter(mayDelete));
      for (const child of children) {
        if (child.containerId && removed.has(child.containerId as ElementId))
          removed.add(child.id as ElementId);
      }
      if (removed.size === 0) return;
      document.canvases[payload.canvasId].elementOrder = document.canvases[
        payload.canvasId
      ].elementOrder.filter((id) => !removed.has(id));
      for (const id of removed) delete document.elements[id];
      for (const connection of Object.values(document.connections)) {
        if (removed.has(connection.source.elementId) || removed.has(connection.target.elementId))
          delete document.connections[connection.id];
      }
      for (const installation of Object.values(document.extensionInstallations)) {
        if (installation.target.kind === "element" && removed.has(installation.target.elementId))
          delete document.extensionInstallations[installation.id];
      }
      // Keep opaque media references/bytes: undo may restore these elements; GC is a separate owner.
    } finally {
      projection.clear();
    }
  },
});

// Close the single-element command bypass in the product registry; generic/harness semantics remain
// unchanged. Both entry points use the same child-cascade and deletion-preference authority.
export const deleteRetainedElementCommand = defineCommandHandler({
  type: "document.element.remove",
  label: "Delete element",
  history: "record",
  payloadSchema: z.object({ elementId }).strict(),
  apply(document, payload) {
    const element = document.elements[payload.elementId];
    if (!element) return [commandRejected("command.payload", "Deletion target does not exist.")];
    return deleteRetainedSelectionCommand.apply(document, {
      canvasId: element.canvasId,
      elementIds: [element.id],
    });
  },
});
