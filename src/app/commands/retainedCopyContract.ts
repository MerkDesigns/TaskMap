import { z } from "zod";
import { DOCUMENT_LIMITS } from "../../domain/document/documentLimits";
import {
  documentElementSchema,
  entityIdSchema,
  extensionInstallationSchema,
  finiteNumberSchema,
} from "../../domain/document/documentSchema";
import { containerElementSchema } from "../../elements/container/containerModel";
import { textCardElementSchema } from "../../elements/text-card/textCardModel";
import { textBlockElementSchema } from "../../elements/text-block/textBlockModel";
import { mindMapNodeElementSchema } from "../../elements/mind-map/mindMapModel";
import { imageElementSchema, imageMediaReferenceSchema } from "../../elements/image/imageModel";
import { mindMapConnectionSchema } from "../../elements/mind-map/mindMapConnectionModel";

// Internal, session-local copy data; not a portable/import format or a second document schema.
export const retainedCopyElementSchema = z.discriminatedUnion("type", [
  containerElementSchema,
  textCardElementSchema,
  textBlockElementSchema,
  mindMapNodeElementSchema,
  imageElementSchema,
]);
export const retainedCopyGraphSchema = z
  .object({
    elements: z.array(retainedCopyElementSchema).min(1).max(DOCUMENT_LIMITS.elementCount),
    connections: z.array(mindMapConnectionSchema).max(DOCUMENT_LIMITS.connectionCount),
    installations: z.array(extensionInstallationSchema).max(DOCUMENT_LIMITS.extensionInstanceCount),
    media: z.array(imageMediaReferenceSchema).max(DOCUMENT_LIMITS.mediaReferenceCount),
  })
  .strict();
export type RetainedCopyGraph = z.infer<typeof retainedCopyGraphSchema>;

const position = z.object({ x: finiteNumberSchema, y: finiteNumberSchema }).strict();
const mapping = <Kind extends "element" | "connection" | "extension-instance">(kind: Kind) =>
  z.object({ sourceId: entityIdSchema(kind), id: entityIdSchema(kind) }).strict();
export const retainedPasteCompletionSchema = z
  .object({
    canvasId: entityIdSchema("canvas"),
    elements: z
      .array(mapping("element").extend({ position }).strict())
      .max(DOCUMENT_LIMITS.elementCount),
    connections: z.array(mapping("connection")).max(DOCUMENT_LIMITS.connectionCount),
    installations: z
      .array(mapping("extension-instance"))
      .max(DOCUMENT_LIMITS.extensionInstanceCount),
  })
  .strict();
export type RetainedPasteCompletion = z.infer<typeof retainedPasteCompletionSchema>;

export const retainedPastePayloadSchema = z
  .object({
    canvasId: entityIdSchema("canvas"),
    elements: z.array(documentElementSchema).min(1).max(DOCUMENT_LIMITS.elementCount),
    connections: z.array(mindMapConnectionSchema).max(DOCUMENT_LIMITS.connectionCount),
    installations: z.array(extensionInstallationSchema).max(DOCUMENT_LIMITS.extensionInstanceCount),
    media: z.array(imageMediaReferenceSchema).max(DOCUMENT_LIMITS.mediaReferenceCount),
  })
  .strict();
