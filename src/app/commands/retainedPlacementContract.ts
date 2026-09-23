import { z } from "zod";
import { elementGeometriesUpdateSchema } from "../../domain/commands/core/elementGeometryCommands";
import { DOCUMENT_LIMITS } from "../../domain/document/documentLimits";
import { entityIdSchema } from "../../domain/document/documentSchema";
import {
  containerPlacementSchema,
  type ContainerPlacement,
} from "../../domain/document/elementPlacement";

const elementId = entityIdSchema("element");

// Capture canonical geometry/placement and all affected siblings before the gesture. The UI
// resolves search/scroll/hit-testing to an index in the full list AFTER removing the moving IDs.
export const retainedPlacementSchema = elementGeometriesUpdateSchema
  .extend({
    moving: z
      .array(z.object({ elementId, from: containerPlacementSchema }).strict())
      .min(1)
      .max(DOCUMENT_LIMITS.elementCount),
    target: z
      .object({
        containerId: elementId,
        index: z.number().int().min(0).max(DOCUMENT_LIMITS.elementCount),
      })
      .strict()
      .nullable(),
    expectedSiblings: z
      .array(
        z
          .object({
            elementId,
            placement: containerPlacementSchema.unwrap(),
          })
          .strict(),
      )
      .max(DOCUMENT_LIMITS.elementCount),
  })
  .strict();

export function samePlacement(left: ContainerPlacement, right: ContainerPlacement): boolean {
  return left === null || right === null
    ? left === right
    : left.containerId === right.containerId && left.order === right.order;
}
