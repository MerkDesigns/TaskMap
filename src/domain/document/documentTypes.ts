import type {
  CanvasId,
  ConnectionId,
  DatabaseId,
  DocumentId,
  ElementId,
  MediaId,
} from "../ids/entityIds";

export type DatabasePurpose = "production" | "development";

export interface CanvasRecord {
  readonly id: CanvasId;
  readonly name: string;
}

export interface DocumentElement {
  readonly id: ElementId;
  readonly canvasId: CanvasId;
  readonly type: string;
  readonly state: Readonly<Record<string, unknown>>;
}

export interface DocumentConnection {
  readonly id: ConnectionId;
  readonly canvasId: CanvasId;
  readonly sourceElementId: ElementId;
  readonly targetElementId: ElementId;
}

export interface MediaReference {
  readonly id: MediaId;
  readonly mimeType: string;
}

export interface TaskMapDocument {
  readonly schemaVersion: number;
  readonly id: DocumentId;
  readonly databaseId: DatabaseId;
  readonly databasePurpose: DatabasePurpose;
  readonly activeCanvasId: CanvasId | null;
  readonly canvases: Readonly<Record<string, CanvasRecord>>;
  readonly elements: Readonly<Record<string, DocumentElement>>;
  readonly connections: Readonly<Record<string, DocumentConnection>>;
  readonly mediaReferences: Readonly<Record<string, MediaReference>>;
  readonly settings: Readonly<Record<string, unknown>>;
}
