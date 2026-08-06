import type { TaskMapDocument } from "./documentTypes";
import { inspectCanvasInvariants } from "./invariants/canvasInvariants";
import { inspectConnectionInvariants } from "./invariants/connectionInvariants";
import { inspectEntityRecordInvariants } from "./invariants/entityRecordInvariants";
import { inspectExtensionInvariants } from "./invariants/extensionInvariants";

export type DocumentInvariantCode =
  | "active-canvas-missing"
  | "active-canvas-required"
  | "active-canvas-unexpected"
  | "canvas-order-duplicate"
  | "canvas-order-missing"
  | "canvas-order-reference-missing"
  | "connection-canvas-missing"
  | "connection-cross-canvas"
  | "connection-endpoint-missing"
  | "element-canvas-missing"
  | "element-order-duplicate"
  | "element-order-missing"
  | "element-order-reference-missing"
  | "element-order-wrong-canvas"
  | "entity-id-duplicate"
  | "entity-key-malformed"
  | "entity-key-mismatch"
  | "extension-installation-duplicate"
  | "extension-target-missing";

export interface DocumentInvariantIssue {
  readonly code: DocumentInvariantCode;
  readonly path: string;
  readonly message: string;
}

export function inspectDocumentInvariants(
  document: TaskMapDocument,
): readonly DocumentInvariantIssue[] {
  return [
    ...inspectEntityRecordInvariants(document),
    ...inspectCanvasInvariants(document),
    ...inspectConnectionInvariants(document),
    ...inspectExtensionInvariants(document),
  ];
}
