import type { TaskMapDocument } from "../documentTypes";
import type { DocumentInvariantIssue } from "../documentInvariants";

export function inspectCanvasInvariants(
  document: TaskMapDocument,
): readonly DocumentInvariantIssue[] {
  const issues: DocumentInvariantIssue[] = [];
  const canvasIds = Object.keys(document.canvases);

  inspectActiveCanvas(document, canvasIds.length, issues);
  inspectCanvasOrder(document, canvasIds, issues);
  inspectElementOwnershipAndOrder(document, issues);
  return issues;
}

function inspectActiveCanvas(
  document: TaskMapDocument,
  canvasCount: number,
  issues: DocumentInvariantIssue[],
) {
  if (canvasCount > 0 && document.activeCanvasId === null) {
    issues.push({
      code: "active-canvas-required",
      path: "activeCanvasId",
      message: "A document containing canvases must have one active canvas",
    });
  } else if (canvasCount === 0 && document.activeCanvasId !== null) {
    issues.push({
      code: "active-canvas-unexpected",
      path: "activeCanvasId",
      message: "A document without canvases cannot have an active canvas",
    });
  } else if (
    document.activeCanvasId !== null &&
    document.canvases[document.activeCanvasId] === undefined
  ) {
    issues.push({
      code: "active-canvas-missing",
      path: "activeCanvasId",
      message: `Active canvas ${document.activeCanvasId} does not exist`,
    });
  }
}

function inspectCanvasOrder(
  document: TaskMapDocument,
  canvasIds: readonly string[],
  issues: DocumentInvariantIssue[],
) {
  const ordered = new Set<string>();
  for (const [index, canvasId] of document.canvasOrder.entries()) {
    if (ordered.has(canvasId)) {
      issues.push({
        code: "canvas-order-duplicate",
        path: `canvasOrder.${index}`,
        message: `Canvas order contains ${canvasId} more than once`,
      });
    } else ordered.add(canvasId);
    if (document.canvases[canvasId] === undefined) {
      issues.push({
        code: "canvas-order-reference-missing",
        path: `canvasOrder.${index}`,
        message: `Canvas order references missing canvas ${canvasId}`,
      });
    }
  }
  for (const canvasId of canvasIds) {
    if (!ordered.has(canvasId)) {
      issues.push({
        code: "canvas-order-missing",
        path: "canvasOrder",
        message: `Canvas order does not contain ${canvasId}`,
      });
    }
  }
}

function inspectElementOwnershipAndOrder(
  document: TaskMapDocument,
  issues: DocumentInvariantIssue[],
) {
  const orderedElements = new Map<string, string>();
  for (const canvas of Object.values(document.canvases)) {
    const localOrder = new Set<string>();
    for (const [index, elementId] of canvas.elementOrder.entries()) {
      const path = `canvases.${canvas.id}.elementOrder.${index}`;
      if (localOrder.has(elementId) || orderedElements.has(elementId)) {
        issues.push({
          code: "element-order-duplicate",
          path,
          message: `Element order contains ${elementId} more than once`,
        });
      } else {
        localOrder.add(elementId);
        orderedElements.set(elementId, canvas.id);
      }
      const element = document.elements[elementId];
      if (element === undefined) {
        issues.push({
          code: "element-order-reference-missing",
          path,
          message: `Element order references missing element ${elementId}`,
        });
      } else if (element.canvasId !== canvas.id) {
        issues.push({
          code: "element-order-wrong-canvas",
          path,
          message: `Element ${elementId} belongs to canvas ${element.canvasId}`,
        });
      }
    }
  }
  for (const element of Object.values(document.elements)) {
    if (document.canvases[element.canvasId] === undefined) {
      issues.push({
        code: "element-canvas-missing",
        path: `elements.${element.id}.canvasId`,
        message: `Element ${element.id} references missing canvas ${element.canvasId}`,
      });
    }
    if (!orderedElements.has(element.id)) {
      issues.push({
        code: "element-order-missing",
        path: `elements.${element.id}`,
        message: `Element ${element.id} is absent from its canvas layer order`,
      });
    }
  }
}
