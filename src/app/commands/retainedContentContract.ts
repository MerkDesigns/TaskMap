import { z } from "zod";
import { entityIdSchema } from "../../domain/document/documentSchema";
import { DOCUMENT_LIMITS } from "../../domain/document/documentLimits";
import { containerContentFieldsSchema } from "../../elements/container/containerModel";
import { textCardContentFieldsSchema } from "../../elements/text-card/textCardModel";
import { textBlockContentFieldsSchema } from "../../elements/text-block/textBlockModel";
import { mindMapContentFieldsSchema } from "../../elements/mind-map/mindMapModel";
import { imageContentFieldsSchema } from "../../elements/image/imageModel";

function edit<Type extends string, Shape extends z.ZodRawShape>(
  type: Type,
  fields: z.ZodObject<Shape, "strict">,
) {
  return z
    .object({
      type: z.literal(type),
      elementId: entityIdSchema("element"),
      from: fields,
      to: fields,
    })
    .strict();
}

// Module-owned scalar fields, explicitly composed here; placement/media/geometry/extensions are
// different actions. Values are committed content, not editor drafts or per-keystroke snapshots.
export const retainedContentSchema = z
  .object({
    canvasId: entityIdSchema("canvas"),
    updates: z
      .array(
        z.discriminatedUnion("type", [
          edit("container", containerContentFieldsSchema),
          edit("text-card", textCardContentFieldsSchema),
          edit("text-block", textBlockContentFieldsSchema),
          edit("mind-map-node", mindMapContentFieldsSchema),
          edit("image", imageContentFieldsSchema),
        ]),
      )
      .min(1)
      .max(DOCUMENT_LIMITS.elementCount),
  })
  .strict();

export type RetainedContentPayload = z.infer<typeof retainedContentSchema>;
