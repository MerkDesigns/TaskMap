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
    canvasOrder: [canvasId],
    canvases: {
      [canvasId]: {
        id: canvasId,
        name: "Phase 2 test canvas",
        settings: { width: 3_000, height: 3_000 },
        elementOrder: [elementId],
      },
    },
    elements: {
      [elementId]: {
        id: elementId,
        canvasId,
        type: "phase2-test-record",
        geometry: { x: 0, y: 0, width: 320, height: 180 },
        data: { text: "Phase 2 encrypted text" },
      },
    },
    connections: {},
    mediaReferences: {},
    extensionInstallations: {},
    documentSettings: {
      grid: { style: "dots", opacityPercent: { dots: 50, lines: 15 } },
      showElementShadows: false,
      allowLockedElementDeletion: true,
      minimapEnabled: true,
    },
  });
}

export function readPhase2TestText(document: TaskMapDocument): string {
  const element = Object.values(document.elements).find(
    (candidate) => candidate.type === "phase2-test-record",
  );
  return typeof element?.data.text === "string" ? element.data.text : "";
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
        data: { ...element.data, text },
      },
    },
  };
}
