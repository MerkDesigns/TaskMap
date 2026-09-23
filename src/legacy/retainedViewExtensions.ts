import type { RetainedActionCallbacks } from "../app/commands/createRetainedActionCallbacks";
import type { TaskMapDocument } from "../domain/document/documentTypes";
import { createEntityId, type ElementId, type UuidSource } from "../domain/ids/entityIds";
import { findArchitectureExtensionDefinition } from "../extensions/architectureRegistry";
import { EXTENSIONS, type ExtensionId } from "../extensions/registry";

/** Presentation aliases only; definitions and compatibility remain in the extension registry. */
export const retainedViewExtensionIds = {
  privacy: "privacy",
  lock: "lock",
  colorPicker: "color-picker",
  search: "search",
  checkbox: "checkbox",
  autoCheckbox: "auto-checkbox",
  counter: "counter",
  inheritCardColor: "inherit-card-color",
  copyPasteJson: "copy-paste-json",
} as const satisfies Partial<Record<ExtensionId, string>>;
export const retainedViewExtensions = EXTENSIONS.filter(({ id }) => id in retainedViewExtensionIds);

export function retainedExtensionId(key: ExtensionId): string | null {
  return key in retainedViewExtensionIds
    ? retainedViewExtensionIds[key as keyof typeof retainedViewExtensionIds]
    : null;
}

export function installRetainedViewExtension(
  actions: RetainedActionCallbacks,
  document: TaskMapDocument | null,
  key: ExtensionId,
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
