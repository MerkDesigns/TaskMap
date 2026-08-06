import type { TaskMapDocument } from "./documentTypes";

export type DocumentInvariantCode =
  | "active-canvas-missing"
  | "entity-key-mismatch"
  | "element-canvas-missing"
  | "connection-canvas-missing"
  | "connection-endpoint-missing";

export interface DocumentInvariantIssue {
  readonly code: DocumentInvariantCode;
  readonly path: string;
  readonly message: string;
}

export function inspectDocumentInvariants(
  document: TaskMapDocument,
): readonly DocumentInvariantIssue[] {
  const issues: DocumentInvariantIssue[] = [];

  if (document.activeCanvasId !== null && !document.canvases[document.activeCanvasId]) {
    issues.push({
      code: "active-canvas-missing",
      path: "activeCanvasId",
      message: `Active canvas ${document.activeCanvasId} does not exist`,
    });
  }

  inspectEntityKeys(document.canvases, "canvases", issues);
  inspectEntityKeys(document.elements, "elements", issues);
  inspectEntityKeys(document.connections, "connections", issues);
  inspectEntityKeys(document.mediaReferences, "mediaReferences", issues);

  for (const element of Object.values(document.elements)) {
    if (!document.canvases[element.canvasId]) {
      issues.push({
        code: "element-canvas-missing",
        path: `elements.${element.id}.canvasId`,
        message: `Element ${element.id} references a missing canvas`,
      });
    }
  }

  for (const connection of Object.values(document.connections)) {
    if (!document.canvases[connection.canvasId]) {
      issues.push({
        code: "connection-canvas-missing",
        path: `connections.${connection.id}.canvasId`,
        message: `Connection ${connection.id} references a missing canvas`,
      });
    }
    if (
      !document.elements[connection.sourceElementId] ||
      !document.elements[connection.targetElementId]
    ) {
      issues.push({
        code: "connection-endpoint-missing",
        path: `connections.${connection.id}`,
        message: `Connection ${connection.id} references a missing element`,
      });
    }
  }

  return issues;
}

function inspectEntityKeys(
  entities: Readonly<Record<string, { readonly id: string }>>,
  collection: string,
  issues: DocumentInvariantIssue[],
) {
  for (const [key, entity] of Object.entries(entities)) {
    if (key !== entity.id) {
      issues.push({
        code: "entity-key-mismatch",
        path: `${collection}.${key}`,
        message: `${collection} key ${key} does not match entity ID ${entity.id}`,
      });
    }
  }
}
