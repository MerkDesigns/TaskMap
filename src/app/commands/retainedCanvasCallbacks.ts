import type { CanvasId } from "../../domain/ids/entityIds";
import { canvasRecordSchema } from "../../domain/document/documentSchema";
import type { createRetainedCompletionOwner } from "./retainedCompletionOwner";
import type { z } from "zod";

export function retainedCanvasCallbacks(owner: ReturnType<typeof createRetainedCompletionOwner>) {
  return {
    captureCreateCanvas() {
      if (!owner.readDocument()) return null;
      return owner.capture(
        "canvas",
        null,
        (_, canvas: z.infer<typeof canvasRecordSchema> | null) => {
          if (canvas === null) return null;
          const parsed = canvasRecordSchema.parse(canvas);
          if (parsed.elementOrder.length) throw new Error("New canvas must be empty");
          return {
            type: "document.canvas.create",
            payload: {
              canvas: { id: canvas.id, name: canvas.name, settings: canvas.settings },
            },
          };
        },
      );
    },
    captureCanvasOrder() {
      const document = owner.readDocument();
      if (!document) return null;
      return owner.capture(
        "canvas",
        document.canvasOrder,
        (from, order: readonly CanvasId[] | null) => {
          if (order === null) return null;
          const current = owner.readDocument()?.canvasOrder;
          if (
            !current ||
            current.length !== from.length ||
            current.some((id, index) => id !== from[index])
          )
            throw new Error("Canvas order changed");
          return current.every((id, index) => id === order[index]) &&
            order.length === current.length
            ? null
            : { type: "document.canvas.reorder", payload: { order } };
        },
      );
    },
    captureCanvasDetails(canvasId: CanvasId) {
      const canvas = owner.readDocument()?.canvases[canvasId];
      if (!canvas) return null;
      return owner.capture(
        "canvas",
        canvas,
        (from, details: { name: string; settings: { width: number; height: number } } | null) => {
          if (!details) return null;
          if (owner.readDocument()?.canvases[canvasId] !== from) throw new Error("Canvas changed");
          return { type: "document.canvas.edit-details", payload: { canvasId, ...details } };
        },
      );
    },
    captureCanvasEdit(canvasId: CanvasId, field: "name" | "settings") {
      const canvas = owner.readDocument()?.canvases[canvasId];
      if (!canvas) return null;
      return owner.capture(
        "canvas",
        canvas[field],
        (from, value: string | { width: number; height: number } | null) => {
          if (value === null) return null;
          if (owner.readDocument()?.canvases[canvasId]?.[field] !== from)
            throw new Error("Canvas changed");
          return field === "name"
            ? { type: "document.canvas.rename", payload: { canvasId, name: value } }
            : { type: "document.canvas.update-settings", payload: { canvasId, settings: value } };
        },
      );
    },
    captureRemoveCanvas(canvasId: CanvasId, operation: "remove" | "clear" = "remove") {
      const document = owner.readDocument();
      const canvas = document?.canvases[canvasId];
      if (!document || !canvas) return null;
      const elements = canvas.elementOrder.map((id) => document.elements[id]);
      const connections = Object.values(document.connections).filter(
        (edge) => edge.canvasId === canvasId,
      );
      const extensions = Object.values(document.extensionInstallations).filter(
        ({ target }) =>
          (target.kind === "canvas" && target.canvasId === canvasId) ||
          (target.kind === "element" && elements.some(({ id }) => id === target.elementId)),
      );
      return owner.capture(
        "canvas",
        { canvas, elements, connections, extensions },
        (from, confirmed: boolean) => {
          if (!confirmed) return null;
          const current = owner.readDocument();
          if (
            !current ||
            current.canvases[canvasId] !== from.canvas ||
            from.elements.some((element) => current.elements[element.id] !== element) ||
            from.connections.length !==
              Object.values(current.connections).filter((edge) => edge.canvasId === canvasId)
                .length ||
            from.connections.some((edge) => current.connections[edge.id] !== edge) ||
            from.extensions.length !==
              Object.values(current.extensionInstallations).filter(
                ({ target }) =>
                  (target.kind === "canvas" && target.canvasId === canvasId) ||
                  (target.kind === "element" &&
                    from.elements.some(({ id }) => id === target.elementId)),
              ).length ||
            from.extensions.some(
              (extension) => current.extensionInstallations[extension.id] !== extension,
            )
          )
            throw new Error("Canvas changed before deletion");
          return {
            type: operation === "clear" ? "document.canvas.clear" : "document.canvas.remove",
            payload: { canvasId },
          };
        },
      );
    },
    switchCanvas(canvasId: CanvasId) {
      if (!owner.readDocument()?.canvases[canvasId])
        return { ok: false as const, code: "invalid-action" as const };
      return owner
        .capture("canvas", canvasId, (id, _input: void) => ({
          type: "document.canvas.set-active",
          payload: { canvasId: id },
        }))
        .complete();
    },
  };
}
