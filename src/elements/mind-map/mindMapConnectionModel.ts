import { z } from "zod";
import { documentConnectionSchema, entityIdSchema } from "../../domain/document/documentSchema";
import type { CanvasId, ElementId } from "../../domain/ids/entityIds";

export const mindMapPortSchema = z.enum(["left", "right", "top", "bottom"]);
const endpointSchema = z
  .object({
    elementId: entityIdSchema("element"),
    portId: mindMapPortSchema,
  })
  .strict();

export const mindMapConnectionSchema = documentConnectionSchema.extend({
  type: z.literal("mind-map"),
  source: endpointSchema,
  target: endpointSchema,
  data: z.object({}).strict(),
});

export type MindMapDocumentConnection = z.infer<typeof mindMapConnectionSchema>;
export type MindMapRelationshipIssue =
  "invalid-connection-endpoint" | "self-connection" | "duplicate-connection-pair";

// The application supplies validated connectable capabilities, not feature type switches here.
export function inspectMindMapConnection(
  connection: MindMapDocumentConnection,
  endpointCanvases: ReadonlyMap<ElementId, CanvasId>,
  connectedPairs: ReadonlySet<string>,
): MindMapRelationshipIssue | null {
  const source = connection.source.elementId;
  const target = connection.target.elementId;
  if (
    endpointCanvases.get(source) !== connection.canvasId ||
    endpointCanvases.get(target) !== connection.canvasId
  )
    return "invalid-connection-endpoint";
  if (source === target) return "self-connection";
  if (connectedPairs.has(mindMapConnectionPairKey(connection))) return "duplicate-connection-pair";
  return null;
}

export function mindMapConnectionPairKey(connection: MindMapDocumentConnection): string {
  return [connection.source.elementId, connection.target.elementId].sort().join("\u0000");
}
