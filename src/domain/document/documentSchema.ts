import { z } from "zod";
import { asEntityId } from "../ids/entityIds";
import type { TaskMapDocument } from "./documentTypes";

export const CURRENT_DOCUMENT_SCHEMA_VERSION = 1;

const entityIdSchema = <Kind extends string>(kind: Kind) =>
  z
    .string()
    .min(1)
    .transform((value) => asEntityId(kind, value));

const canvasIdSchema = entityIdSchema("canvas");
const elementIdSchema = entityIdSchema("element");

const canvasSchema = z
  .object({
    id: canvasIdSchema,
    name: z.string(),
  })
  .strict();

const elementSchema = z
  .object({
    id: elementIdSchema,
    canvasId: canvasIdSchema,
    type: z.string().min(1),
    state: z.record(z.unknown()),
  })
  .strict();

const connectionSchema = z
  .object({
    id: entityIdSchema("connection"),
    canvasId: canvasIdSchema,
    sourceElementId: elementIdSchema,
    targetElementId: elementIdSchema,
  })
  .strict();

const mediaReferenceSchema = z
  .object({
    id: entityIdSchema("media"),
    mimeType: z.string().min(1),
  })
  .strict();

export const taskMapDocumentSchema = z
  .object({
    schemaVersion: z.literal(CURRENT_DOCUMENT_SCHEMA_VERSION),
    id: entityIdSchema("document"),
    databaseId: entityIdSchema("database"),
    databasePurpose: z.enum(["production", "development"]),
    activeCanvasId: canvasIdSchema.nullable(),
    canvases: z.record(canvasSchema),
    elements: z.record(elementSchema),
    connections: z.record(connectionSchema),
    mediaReferences: z.record(mediaReferenceSchema),
    settings: z.record(z.unknown()),
  })
  .strict();

export function parseTaskMapDocument(input: unknown): TaskMapDocument {
  return taskMapDocumentSchema.parse(input);
}
