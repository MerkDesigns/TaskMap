import { z } from "zod";
import { DOCUMENT_LIMITS } from "../../domain/document/documentLimits";
import { documentElementSchema } from "../../domain/document/documentSchema";
import { containerPlacementSchema } from "../../domain/document/elementPlacement";

// Placement is child-owned. Null means a root card; no redundant container child list.
export const textCardDataSchema = z
  .object({
    text: z.string().max(DOCUMENT_LIMITS.jsonStringLength),
    accent: z.string().min(1).max(DOCUMENT_LIMITS.jsonStringLength),
    link: z.string().max(DOCUMENT_LIMITS.jsonStringLength).nullable(),
    placement: containerPlacementSchema,
  })
  .strict();

export const textCardElementSchema = documentElementSchema.extend({
  type: z.literal("text-card"),
  data: textCardDataSchema,
});

export type TextCardData = z.infer<typeof textCardDataSchema>;
export const textCardContentFieldsSchema = textCardDataSchema.omit({ placement: true }).partial();
export type TextCardDocumentElement = z.infer<typeof textCardElementSchema>;
