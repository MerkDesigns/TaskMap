import { z } from "zod";
import { DOCUMENT_LIMITS } from "../../domain/document/documentLimits";
import { documentElementSchema } from "../../domain/document/documentSchema";

// Mind-map nodes are root, content-sized cards, with no text-card link/placement fields.
export const mindMapNodeDataSchema = z
  .object({
    text: z.string().max(DOCUMENT_LIMITS.jsonStringLength),
    accent: z.string().min(1).max(DOCUMENT_LIMITS.jsonStringLength),
  })
  .strict();

export const mindMapNodeElementSchema = documentElementSchema.extend({
  type: z.literal("mind-map-node"),
  data: mindMapNodeDataSchema,
});

export type MindMapNodeData = z.infer<typeof mindMapNodeDataSchema>;
export const mindMapContentFieldsSchema = mindMapNodeDataSchema.partial();
export type MindMapNodeDocumentElement = z.infer<typeof mindMapNodeElementSchema>;
