import type { RetainedActionCallbacks } from "../app/commands/createRetainedActionCallbacks";
import type { TaskMapDocument } from "../domain/document/documentTypes";
import { createEntityId, type ElementId, type UuidSource } from "../domain/ids/entityIds";
import {
  findArchitectureExtensionDefinition,
  getArchitectureExtensionDefinitions,
} from "../extensions/architectureRegistry";
import type { RetainedExtensionKey } from "../extensions/retainedExtensionDefinition";

/** The registered definition id for an extension's view key, or null for an unknown key. */
export function retainedExtensionId(key: RetainedExtensionKey): string | null {
  return getArchitectureExtensionDefinitions().find(({ viewKey }) => viewKey === key)?.id ?? null;
}

export function installRetainedViewExtension(
  actions: RetainedActionCallbacks,
  document: TaskMapDocument | null,
  key: RetainedExtensionKey,
  ids: readonly string[],
  idSource: UuidSource,
): boolean {
  const extensionId = retainedExtensionId(key);
  const definition = extensionId ? findArchitectureExtensionDefinition(extensionId) : null;
  if (!document || !definition || !extensionId) return false;
  const targets = [...new Set(ids)].filter((id) => {
    const element = document.elements[id as ElementId];
    return (
      element?.canvasId === document.activeCanvasId &&
      definition.compatibleElementTypes.includes(element.type)
    );
  }) as ElementId[];
  const installed = new Set(
    Object.values(document.extensionInstallations)
      .filter((entry) => entry.extensionId === extensionId && entry.target.kind === "element")
      .map((entry) => (entry.target.kind === "element" ? entry.target.elementId : "")),
  );
  return (
    actions.captureExtensionInstall(extensionId, targets)?.complete(
      targets
        .filter((id) => !installed.has(id))
        .map((elementId) => ({
          elementId,
          installationId: createEntityId("extension-instance", idSource),
        })),
    ).ok ?? false
  );
}
