import { z } from "zod";
import { isEntityId, type EntityId, type EntityIdKind } from "../ids/entityIds";
import { DOCUMENT_LIMITS } from "./documentLimits";
import type { JsonObject, JsonValue, TaskMapDocument } from "./documentTypes";
import { CURRENT_DOCUMENT_SCHEMA_VERSION } from "./documentVersion";
import { inspectJsonSafety } from "./jsonSafety";

export { CURRENT_DOCUMENT_SCHEMA_VERSION } from "./documentVersion";

const entityIdSchema = <Kind extends EntityIdKind>(kind: Kind) =>
  z.string().refine((value): value is EntityId<Kind> => isEntityId(kind, value), {
    message: `Invalid ${kind} ID`,
  });

const canvasIdSchema = entityIdSchema("canvas");
const elementIdSchema = entityIdSchema("element");
const finiteNumber = z.number().finite();
const positiveInteger = z.number().int().positive();
const moduleIdSchema = z
  .string()
  .min(1)
  .max(DOCUMENT_LIMITS.typeIdentifierLength)
  .regex(/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/);

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.null(),
    z.boolean(),
    finiteNumber,
    z.string().max(DOCUMENT_LIMITS.jsonStringLength),
    z.array(jsonValueSchema).max(DOCUMENT_LIMITS.jsonArrayLength),
    z.record(z.string().max(DOCUMENT_LIMITS.jsonStringLength), jsonValueSchema),
  ]),
);
const jsonObjectSchema: z.ZodType<JsonObject> = z.record(
  z.string().max(DOCUMENT_LIMITS.jsonStringLength),
  jsonValueSchema,
);

const canvasSchema = z
  .object({
    id: canvasIdSchema,
    name: z.string().min(1).max(DOCUMENT_LIMITS.canvasNameLength),
    settings: z
      .object({
        width: finiteNumber.positive().max(DOCUMENT_LIMITS.canvasDimension),
        height: finiteNumber.positive().max(DOCUMENT_LIMITS.canvasDimension),
      })
      .strict(),
    elementOrder: z.array(elementIdSchema).max(DOCUMENT_LIMITS.elementCount),
  })
  .strict();

const geometrySchema = z
  .object({
    x: finiteNumber
      .min(-DOCUMENT_LIMITS.elementCoordinateMagnitude)
      .max(DOCUMENT_LIMITS.elementCoordinateMagnitude),
    y: finiteNumber
      .min(-DOCUMENT_LIMITS.elementCoordinateMagnitude)
      .max(DOCUMENT_LIMITS.elementCoordinateMagnitude),
    width: finiteNumber.positive().max(DOCUMENT_LIMITS.elementDimension),
    height: finiteNumber.positive().max(DOCUMENT_LIMITS.elementDimension),
  })
  .strict();

const elementSchema = z
  .object({
    id: elementIdSchema,
    canvasId: canvasIdSchema,
    type: moduleIdSchema,
    geometry: geometrySchema,
    data: jsonObjectSchema,
  })
  .strict();

const endpointSchema = z
  .object({
    elementId: elementIdSchema,
    portId: z.string().min(1).max(DOCUMENT_LIMITS.typeIdentifierLength).nullable(),
  })
  .strict();

const connectionSchema = z
  .object({
    id: entityIdSchema("connection"),
    canvasId: canvasIdSchema,
    type: moduleIdSchema,
    source: endpointSchema,
    target: endpointSchema,
    data: jsonObjectSchema,
  })
  .strict();

const mediaReferenceSchema = z
  .object({
    id: entityIdSchema("media"),
    mimeType: z
      .string()
      .min(1)
      .max(255)
      .regex(/^[\x20-\x7e]+\/[\x20-\x7e]+$/),
    byteLength: z.number().int().min(0).max(DOCUMENT_LIMITS.mediaByteLength),
    pixelWidth: positiveInteger.max(DOCUMENT_LIMITS.elementDimension).nullable(),
    pixelHeight: positiveInteger.max(DOCUMENT_LIMITS.elementDimension).nullable(),
    altText: z.string().max(DOCUMENT_LIMITS.mediaAltTextLength).nullable(),
  })
  .strict();

const extensionTargetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("document"), documentId: entityIdSchema("document") }).strict(),
  z.object({ kind: z.literal("canvas"), canvasId: canvasIdSchema }).strict(),
  z.object({ kind: z.literal("element"), elementId: elementIdSchema }).strict(),
]);

const extensionInstallationSchema = z
  .object({
    id: entityIdSchema("extension-instance"),
    extensionId: entityIdSchema("extension"),
    target: extensionTargetSchema,
    enabled: z.boolean(),
    configuration: jsonObjectSchema,
  })
  .strict();

const documentSettingsSchema = z
  .object({
    grid: z
      .object({
        style: z.enum(["dots", "lines"]),
        opacityPercent: z
          .object({ dots: finiteNumber.min(0).max(100), lines: finiteNumber.min(0).max(100) })
          .strict(),
      })
      .strict(),
    showElementShadows: z.boolean(),
    allowLockedElementDeletion: z.boolean(),
    minimapEnabled: z.boolean(),
  })
  .strict();

export const taskMapDocumentSchema = z
  .object({
    schemaVersion: z.literal(CURRENT_DOCUMENT_SCHEMA_VERSION),
    id: entityIdSchema("document"),
    databaseId: entityIdSchema("database"),
    databasePurpose: z.enum(["production", "development"]),
    activeCanvasId: canvasIdSchema.nullable(),
    canvasOrder: z.array(canvasIdSchema).max(DOCUMENT_LIMITS.canvasCount),
    canvases: limitedRecord(canvasSchema, DOCUMENT_LIMITS.canvasCount),
    elements: limitedRecord(elementSchema, DOCUMENT_LIMITS.elementCount),
    connections: limitedRecord(connectionSchema, DOCUMENT_LIMITS.connectionCount),
    mediaReferences: limitedRecord(mediaReferenceSchema, DOCUMENT_LIMITS.mediaReferenceCount),
    extensionInstallations: limitedRecord(
      extensionInstallationSchema,
      DOCUMENT_LIMITS.extensionInstanceCount,
    ),
    documentSettings: documentSettingsSchema,
  })
  .strict();

export interface DocumentStructureIssue {
  readonly code:
    | "invalid-structure"
    | "json-limit-exceeded"
    | "json-unsafe-value"
    | "limit-exceeded"
    | "malformed-id"
    | "unknown-field"
    | "unsupported-schema-version";
  readonly path: string;
  readonly message: string;
}

export class DocumentStructureError extends Error {
  constructor(readonly issues: readonly DocumentStructureIssue[]) {
    super("The TaskMap document structure is invalid");
    this.name = "DocumentStructureError";
  }
}

export function parseTaskMapDocument(input: unknown): TaskMapDocument {
  const safetyIssues = inspectJsonSafety(input);
  if (safetyIssues.length > 0) throw new DocumentStructureError(safetyIssues);

  const result = taskMapDocumentSchema.safeParse(input);
  if (!result.success) {
    throw new DocumentStructureError(result.error.issues.map(toStructureIssue));
  }
  return result.data satisfies TaskMapDocument;
}

function limitedRecord<Value extends z.ZodTypeAny>(schema: Value, maximum: number) {
  return z.record(schema).superRefine((record, context) => {
    if (Object.keys(record).length > maximum) {
      context.addIssue({
        code: z.ZodIssueCode.too_big,
        type: "array",
        maximum,
        inclusive: true,
        message: `Collection must contain at most ${maximum} records`,
      });
    }
  });
}

function toStructureIssue(issue: z.ZodIssue): DocumentStructureIssue {
  const path = issue.path.length === 0 ? "$" : issue.path.join(".");
  if (issue.path[0] === "schemaVersion") {
    return { code: "unsupported-schema-version", path, message: issue.message };
  }
  if (issue.message.startsWith("Invalid ") && issue.message.endsWith(" ID")) {
    return { code: "malformed-id", path, message: issue.message };
  }
  if (issue.code === z.ZodIssueCode.unrecognized_keys) {
    return { code: "unknown-field", path, message: issue.message };
  }
  if (issue.code === z.ZodIssueCode.too_big) {
    return { code: "limit-exceeded", path, message: issue.message };
  }
  return { code: "invalid-structure", path, message: issue.message };
}
