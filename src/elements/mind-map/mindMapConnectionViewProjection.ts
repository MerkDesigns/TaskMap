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
