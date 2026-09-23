import { z } from "zod";
import { DOCUMENT_LIMITS } from "../../domain/document/documentLimits";
import { documentElementSchema } from "../../domain/document/documentSchema";

export const containerDataSchema = z
  .object({
    name: z.string().max(DOCUMENT_LIMITS.jsonStringLength),
    accent: z.string().min(1).max(DOCUMENT_LIMITS.jsonStringLength),
    headerButtonsVisible: z.boolean(),
  })
  .strict();

export const containerElementSchema = documentElementSchema.extend({
  type: z.literal("container"),
  data: containerDataSchema,
});

export type ContainerData = z.infer<typeof containerDataSchema>;
export const containerContentFieldsSchema = containerDataSchema.partial();
export type ContainerDocumentElement = z.infer<typeof containerElementSchema>;
