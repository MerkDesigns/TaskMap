import { asEntityId, type CanvasId, type ElementId } from "../../domain/ids/entityIds";
import { TEST_IDS } from "../../elements/cardContainerTestFixtures";
import { geometryInput, geometryIds as ids } from "./retainedGeometryTestSupport";
import { captureRetainedCopy } from "./retainedCopySnapshot";
import type { TaskMapDocument } from "../../domain/document/documentTypes";
import type { RetainedCopyGraph } from "./retainedCopyContract";

export function copyInput() {
  const input = geometryInput();
  input.elements[ids.image].data.placement = null;
  input.connections[TEST_IDS.connection] = {
    id: TEST_IDS.connection,
    canvasId: TEST_IDS.canvasA,
    type: "mind-map",
    source: { elementId: ids.container, portId: "right" },
    target: { elementId: ids.image, portId: "left" },
    data: {},
  };
  input.extensionInstallations[TEST_IDS.extensionA] = {
    id: TEST_IDS.extensionA,
    extensionId: "lock",
    enabled: false,
    target: { kind: "element", elementId: ids.container },
    configuration: { enabled: true },
  };
  input.extensionInstallations[TEST_IDS.extensionB] = {
    id: TEST_IDS.extensionB,
    extensionId: "checkbox",
    enabled: true,
    target: { kind: "element", elementId: ids.card },
    configuration: { checked: true },
  };
  return input;
}

export const copiedElementId = (index: number) =>
  asEntityId(
    "element",
    `element-00000000-0000-4000-8000-${String(index + 2000).padStart(12, "0")}`,
  );
export function copyCompletion(snapshot: RetainedCopyGraph, canvasId: CanvasId = TEST_IDS.canvasA) {
  return {
    canvasId,
    elements: snapshot.elements.map((element, index) => ({
      sourceId: element.id,
      id: copiedElementId(index),
      position: { x: element.geometry.x + 100, y: element.geometry.y + 200 },
    })),
    connections: snapshot.connections.map((edge, index) => ({
      sourceId: edge.id,
      id: asEntityId(
        "connection",
        `connection-00000000-0000-4000-8000-${String(index + 2000).padStart(12, "0")}`,
      ),
    })),
    installations: snapshot.installations.map((entry, index) => ({
      sourceId: entry.id,
      id: asEntityId(
        "extension-instance",
        `extension-instance-00000000-0000-4000-8000-${String(index + 2000).padStart(12, "0")}`,
      ),
    })),
  };
}
export function prepareCopy(
  document: TaskMapDocument,
  elementIds: readonly ElementId[] = Object.values(ids),
) {
  const snapshot = captureRetainedCopy(document, elementIds)!;
  return { snapshot, completion: copyCompletion(snapshot) };
}
