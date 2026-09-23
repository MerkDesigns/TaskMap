import { z } from "zod";
import { DOCUMENT_LIMITS } from "../../document/documentLimits";
import { elementGeometrySchema, entityIdSchema } from "../../document/documentSchema";
import type { ElementGeometry } from "../../document/documentTypes";
import { commandRejected, defineCommandHandler } from "../commandHandler";

export const elementGeometriesUpdateSchema = z
  .object({
    canvasId: entityIdSchema("canvas"),
    updates: z
      .array(
        z
          .object({
            elementId: entityIdSchema("element"),
            from: elementGeometrySchema,
            to: elementGeometrySchema,
          })
          .strict(),
      )
      .min(1)
      .max(DOCUMENT_LIMITS.elementCount),
  })
  .strict();

/** One completed group edit, not a sequence of per-element history/save operations. */
export const updateElementGeometriesCommand = defineCommandHandler({
  type: "document.elements.update-geometry",
  label: "Update element geometry",
  history: "record",
  payloadSchema: elementGeometriesUpdateSchema,
  apply(document, { canvasId, updates }) {
    const seen = new Set<string>();
    for (const update of updates) {
      const element = document.elements[update.elementId];
      if (seen.has(update.elementId)) {
        return [commandRejected("command.payload.updates", "An element occurs more than once")];
      }
      seen.add(update.elementId);
      if (!element || element.canvasId !== canvasId) {
        return [
          commandRejected("command.payload.updates", "An element is not in the target canvas"),
        ];
      }
      if (!sameGeometry(element.geometry, update.from)) {
        return [
          commandRejected("command.payload.updates", "Element geometry changed before completion"),
        ];
      }
    }
    for (const update of updates) {
      const element = document.elements[update.elementId];
      // Equal-value replacement would otherwise create a patch and schedule an unnecessary save.
      if (!sameGeometry(element.geometry, update.to)) element.geometry = update.to;
    }
  },
});

function sameGeometry(left: ElementGeometry, right: ElementGeometry): boolean {
  return (
    left.x === right.x &&
    left.y === right.y &&
    left.width === right.width &&
    left.height === right.height
  );
}
