import type { DocumentConnection, TaskMapDocument } from "../documentTypes";
import type { DocumentInvariantIssue } from "../documentInvariants";

export function inspectConnectionInvariants(
  document: TaskMapDocument,
): readonly DocumentInvariantIssue[] {
  const issues: DocumentInvariantIssue[] = [];
  for (const connection of Object.values(document.connections)) {
    inspectConnection(document, connection, issues);
  }
  return issues;
}

function inspectConnection(
  document: TaskMapDocument,
  connection: DocumentConnection,
  issues: DocumentInvariantIssue[],
) {
  if (document.canvases[connection.canvasId] === undefined) {
    issues.push({
      code: "connection-canvas-missing",
      path: `connections.${connection.id}.canvasId`,
      message: `Connection ${connection.id} references missing canvas ${connection.canvasId}`,
    });
  }

  const source = document.elements[connection.source.elementId];
  const target = document.elements[connection.target.elementId];
  if (source === undefined) {
    issues.push({
      code: "connection-endpoint-missing",
      path: `connections.${connection.id}.source.elementId`,
      message: `Connection ${connection.id} references missing source element`,
    });
  }
  if (target === undefined) {
    issues.push({
      code: "connection-endpoint-missing",
      path: `connections.${connection.id}.target.elementId`,
      message: `Connection ${connection.id} references missing target element`,
    });
  }
  if (
    source !== undefined &&
    target !== undefined &&
    (source.canvasId !== target.canvasId || source.canvasId !== connection.canvasId)
  ) {
    issues.push({
      code: "connection-cross-canvas",
      path: `connections.${connection.id}`,
      message: `Connection ${connection.id} and both endpoints must share one canvas`,
    });
  }
}
