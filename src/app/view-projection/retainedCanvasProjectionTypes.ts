import type {
  CanvasId,
  ConnectionId,
  ElementId,
  MediaId,
  ExtensionInstanceId,
} from "../../domain/ids/entityIds";
import type { ExtensionInstallation } from "../../domain/document/documentTypes";
import type { RetainedImageView } from "../../elements/image/imageViewProjection";
import type { ImageMediaMetadata } from "../../elements/image/imageModel";
import type {
  ContainerElement,
  MindmapConnection,
  TextBlockElement,
  TextCardElement,
} from "../../types";
import type { MindMapRelationshipIssue } from "../../elements/mind-map/mindMapConnectionModel";

export interface RetainedCanvasView {
  readonly id: CanvasId;
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly containers: readonly Readonly<ContainerElement>[];
  readonly textCards: readonly Readonly<TextCardElement>[];
  readonly textBlocks: readonly Readonly<TextBlockElement>[];
  readonly images: readonly RetainedImageView[];
  readonly mindmapConnections: readonly Readonly<MindmapConnection>[];
}

export interface RetainedCanvasProjectionIssue {
  readonly code:
    | "unsupported-element"
    | "invalid-element-data"
    | "unsupported-connection"
    | "invalid-connection-data"
    | MindMapRelationshipIssue
    | "unsupported-extension"
    | "incompatible-extension-target"
    | "invalid-extension-configuration"
    | "duplicate-extension-installation"
    | "conflicting-extension-installation"
    | "invalid-image-media"
    | "missing-image-media"
    | "invalid-container-parent"
    | "duplicate-child-order";
  readonly elementId?: ElementId;
  readonly connectionId?: ConnectionId;
  readonly mediaId?: MediaId;
  readonly extensionInstanceId?: ExtensionInstanceId;
}

export type RetainedCanvasProjectionResult =
  | {
      readonly ok: true;
      readonly canvases: readonly RetainedCanvasView[];
      readonly mediaReferences: readonly ImageMediaMetadata[];
      readonly extensionInstallations: readonly ExtensionInstallation[];
    }
  | {
      readonly ok: false;
      readonly issues: readonly RetainedCanvasProjectionIssue[];
    };
