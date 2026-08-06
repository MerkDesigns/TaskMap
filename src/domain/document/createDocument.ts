import { createEntityId, type DatabaseId, type UuidSource } from "../ids/entityIds";
import { parseTaskMapDocument } from "./documentSchema";
import type { DatabasePurpose, TaskMapDocument } from "./documentTypes";
import { CURRENT_DOCUMENT_SCHEMA_VERSION } from "./documentVersion";

export interface CreateDocumentOptions {
  readonly databaseId: DatabaseId;
  readonly databasePurpose: DatabasePurpose;
  readonly idSource: UuidSource;
  readonly initialCanvasName?: string;
}

export function createTaskMapDocument(options: CreateDocumentOptions): TaskMapDocument {
  const documentId = createEntityId("document", options.idSource);
  const canvasId = createEntityId("canvas", options.idSource);
  return parseTaskMapDocument({
    schemaVersion: CURRENT_DOCUMENT_SCHEMA_VERSION,
    id: documentId,
    databaseId: options.databaseId,
    databasePurpose: options.databasePurpose,
    activeCanvasId: canvasId,
    canvasOrder: [canvasId],
    canvases: {
      [canvasId]: {
        id: canvasId,
        name: options.initialCanvasName ?? "Canvas 1",
        settings: { width: 3_000, height: 3_000 },
        elementOrder: [],
      },
    },
    elements: {},
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
