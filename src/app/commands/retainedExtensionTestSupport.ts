import { asEntityId, type ElementId } from "../../domain/ids/entityIds";
import type { TaskMapDocument } from "../../domain/document/documentTypes";
import { captureRetainedExtensions, extensionEditCommand } from "./retainedExtensionSnapshot";

export const extensionTestId = (index: number) =>
  asEntityId(
    "extension-instance",
    `extension-instance-00000000-0000-4000-8000-${String(300 + index).padStart(12, "0")}`,
  );
export const installIds = (ids: readonly ElementId[]) =>
  ids.map((elementId, index) => ({
    elementId,
    installationId: extensionTestId(index),
  }));
export function extensionInstallation(
  document: TaskMapDocument,
  extensionId: string,
  elementId: ElementId,
) {
  return Object.values(document.extensionInstallations).find(
    (entry) =>
      entry.extensionId === extensionId &&
      entry.target.kind === "element" &&
      entry.target.elementId === elementId,
  )!;
}
export function extensionTestCommand(document: TaskMapDocument, elementIds: readonly ElementId[]) {
  const snapshot = captureRetainedExtensions(document, "lock", elementIds)!;
  const updates = snapshot.updates.map((update, index) => ({
    ...update,
    to: {
      id: extensionTestId(index),
      extensionId: asEntityId("extension", "lock"),
      target: { kind: "element" as const, elementId: update.elementId },
      enabled: true,
      configuration: { enabled: true },
    },
  }));
  return extensionEditCommand(snapshot.canvasId, updates);
}
