import { z } from "zod";
import { DOCUMENT_LIMITS } from "../../domain/document/documentLimits";
import { documentElementSchema } from "../../domain/document/documentSchema";

export const textBlockDataSchema = z
  .object({
    name: z.string().max(DOCUMENT_LIMITS.jsonStringLength),
    text: z.string().max(DOCUMENT_LIMITS.jsonStringLength),
    accent: z.string().min(1).max(DOCUMENT_LIMITS.jsonStringLength),
    headerButtonsVisible: z.boolean(),
  })
  .strict();

export const textBlockElementSchema = documentElementSchema.extend({
  type: z.literal("text-block"),
  data: textBlockDataSchema,
});

export type TextBlockData = z.infer<typeof textBlockDataSchema>;
export const textBlockContentFieldsSchema = textBlockDataSchema.partial();
export type TextBlockDocumentElement = z.infer<typeof textBlockElementSchema>;
