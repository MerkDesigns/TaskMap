import {
  CURRENT_DOCUMENT_SCHEMA_VERSION,
  parseTaskMapDocument,
} from "../../domain/document/documentSchema";
import type { DatabasePurpose, TaskMapDocument } from "../../domain/document/documentTypes";

export function createPhase2TestDocument(
  databaseId: string,
  purpose: DatabasePurpose,
  createId: () => string = () => globalThis.crypto.randomUUID(),
): TaskMapDocument {
  const canvasId = `canvas-${createId()}`;
  const elementId = `element-${createId()}`;
  return parseTaskMapDocument({
    schemaVersion: CURRENT_DOCUMENT_SCHEMA_VERSION,
    id: `document-${createId()}`,
    databaseId,
    databasePurpose: purpose,
    activeCanvasId: canvasId,
    canvases: {
      [canvasId]: { id: canvasId, name: "Phase 2 test canvas" },
    },
    elements: {
      [elementId]: {
        id: elementId,
        canvasId,
        type: "phase2-test-record",
        state: { text: "Phase 2 encrypted text" },
      },
    },
    connections: {},
    mediaReferences: {},
    settings: {},
  });
}

export function readPhase2TestText(document: TaskMapDocument): string {
  const element = Object.values(document.elements).find(
    (candidate) => candidate.type === "phase2-test-record",
  );
  return typeof element?.state.text === "string" ? element.state.text : "";
}

export function updatePhase2TestText(document: TaskMapDocument, text: string): TaskMapDocument {
  const entry = Object.entries(document.elements).find(
    ([, element]) => element.type === "phase2-test-record",
  );
  if (!entry) return document;
  const [id, element] = entry;
  return {
    ...document,
    elements: {
      ...document.elements,
      [id]: {
        ...element,
        state: { ...element.state, text },
      },
    },
  };
}
