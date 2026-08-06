import type {
  CanvasId,
  ConnectionId,
  DatabaseId,
  DocumentId,
  ElementId,
  ExtensionId,
  ExtensionInstanceId,
  MediaId,
} from "../ids/entityIds";
import type { CURRENT_DOCUMENT_SCHEMA_VERSION } from "./documentVersion";

export type DatabasePurpose = "production" | "development";
export type JsonPrimitive = boolean | number | string | null;
export type JsonValue = JsonPrimitive | JsonObject | readonly JsonValue[];
export type JsonObject = { readonly [key: string]: JsonValue };

export interface CanvasSettings {
  readonly width: number;
  readonly height: number;
}

export interface CanvasRecord {
  readonly id: CanvasId;
  readonly name: string;
  readonly settings: CanvasSettings;
  readonly elementOrder: readonly ElementId[];
}

export interface ElementGeometry {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface DocumentElement {
  readonly id: ElementId;
  readonly canvasId: CanvasId;
  readonly type: string;
  readonly geometry: ElementGeometry;
  readonly data: JsonObject;
}

export interface ConnectionEndpoint {
  readonly elementId: ElementId;
  readonly portId: string | null;
}

export interface DocumentConnection {
  readonly id: ConnectionId;
  readonly canvasId: CanvasId;
  readonly type: string;
  readonly source: ConnectionEndpoint;
  readonly target: ConnectionEndpoint;
  readonly data: JsonObject;
}

export interface MediaReference {
  readonly id: MediaId;
  readonly mimeType: string;
  readonly byteLength: number;
  readonly pixelWidth: number | null;
  readonly pixelHeight: number | null;
  readonly altText: string | null;
}

export type ExtensionTarget =
  | { readonly kind: "document"; readonly documentId: DocumentId }
  | { readonly kind: "canvas"; readonly canvasId: CanvasId }
  | { readonly kind: "element"; readonly elementId: ElementId };

export interface ExtensionInstallation {
  readonly id: ExtensionInstanceId;
  readonly extensionId: ExtensionId;
  readonly target: ExtensionTarget;
  readonly enabled: boolean;
  readonly configuration: JsonObject;
}

export interface DocumentSettings {
  readonly grid: {
    readonly style: "dots" | "lines";
    readonly opacityPercent: {
      readonly dots: number;
      readonly lines: number;
    };
  };
  readonly showElementShadows: boolean;
  readonly allowLockedElementDeletion: boolean;
  readonly minimapEnabled: boolean;
}

export interface TaskMapDocument {
  readonly schemaVersion: typeof CURRENT_DOCUMENT_SCHEMA_VERSION;
  readonly id: DocumentId;
  readonly databaseId: DatabaseId;
  readonly databasePurpose: DatabasePurpose;
  readonly activeCanvasId: CanvasId | null;
  readonly canvasOrder: readonly CanvasId[];
  readonly canvases: Readonly<Record<CanvasId, CanvasRecord>>;
  readonly elements: Readonly<Record<ElementId, DocumentElement>>;
  readonly connections: Readonly<Record<ConnectionId, DocumentConnection>>;
  readonly mediaReferences: Readonly<Record<MediaId, MediaReference>>;
  readonly extensionInstallations: Readonly<Record<ExtensionInstanceId, ExtensionInstallation>>;
  readonly documentSettings: DocumentSettings;
}
