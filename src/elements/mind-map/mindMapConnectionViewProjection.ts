import type { DocumentConnection } from "../../domain/document/documentTypes";
import type { MindmapConnection } from "../../types";
import type { MindMapDocumentConnection } from "./mindMapConnectionModel";

export function projectMindMapConnection(
  connection: MindMapDocumentConnection,
): Readonly<MindmapConnection> {
  return Object.freeze({
    id: connection.id,
    sourceId: connection.source.elementId,
    sourcePort: connection.source.portId,
    targetId: connection.target.elementId,
    targetPort: connection.target.portId,
  });
}

/**
 * The canvas's mind-map connections in document order. The canvas binding only admits documents
 * whose connections passed their schema and endpoint checks in the projection.
 */
export function canvasMindMapConnections(
  connections: Readonly<Record<string, DocumentConnection>>,
  canvasId: string,
): readonly MindMapDocumentConnection[] {
  return Object.values(connections).filter(
    (connection): connection is MindMapDocumentConnection =>
      connection.type === "mind-map" && connection.canvasId === canvasId,
  );
}
