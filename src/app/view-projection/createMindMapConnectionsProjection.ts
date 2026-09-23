import type { DocumentConnection, TaskMapDocument } from "../../domain/document/documentTypes";
import type { CanvasId, ElementId } from "../../domain/ids/entityIds";
import {
  inspectMindMapConnection,
  mindMapConnectionPairKey,
  mindMapConnectionSchema,
  type MindMapDocumentConnection,
} from "../../elements/mind-map/mindMapConnectionModel";
import { projectMindMapConnection } from "../../elements/mind-map/mindMapConnectionViewProjection";
import type { MindmapConnection } from "../../types";
import type { RetainedCanvasProjectionIssue } from "./retainedCanvasProjectionTypes";

export function createMindMapConnectionsProjection() {
  let cache = new WeakMap<
    DocumentConnection,
    {
      parsed: MindMapDocumentConnection;
      view: Readonly<MindmapConnection>;
    }
  >();

  function project(document: TaskMapDocument, endpointCanvases: ReadonlyMap<ElementId, CanvasId>) {
    const byCanvas = new Map<CanvasId, Readonly<MindmapConnection>[]>();
    const issues: RetainedCanvasProjectionIssue[] = [];
    const pairs = new Set<string>();
    // One traversal for the entire document, not one connection scan per canvas.
    for (const connection of Object.values(document.connections)) {
      const connectionId = connection.id;
      if (connection.type !== "mind-map") {
        issues.push({ code: "unsupported-connection", connectionId });
        continue;
      }
      let entry = cache.get(connection);
      if (!entry) {
        const parsed = mindMapConnectionSchema.safeParse(connection);
        if (!parsed.success) {
          issues.push({ code: "invalid-connection-data", connectionId });
          continue;
        }
        entry = { parsed: parsed.data, view: projectMindMapConnection(parsed.data) };
        cache.set(connection, entry);
      }
      // Cached shape/props never skip validation against this revision's endpoint capabilities.
      const issue = inspectMindMapConnection(entry.parsed, endpointCanvases, pairs);
      if (issue) {
        issues.push({ code: issue, connectionId });
        continue;
      }
      pairs.add(mindMapConnectionPairKey(entry.parsed));
      const connections = byCanvas.get(connection.canvasId) ?? [];
      connections.push(entry.view);
      byCanvas.set(connection.canvasId, connections);
    }
    return { byCanvas, issues };
  }

  return {
    project,
    clear: () => {
      cache = new WeakMap();
    },
  };
}
