import type { ElementId, ExtensionInstanceId } from "../../domain/ids/entityIds";
import type { createRetainedCompletionOwner } from "./retainedCompletionOwner";
import { captureRetainedExtensions, extensionEditCommand } from "./retainedExtensionSnapshot";

export interface ExtensionInstallId {
  readonly elementId: ElementId;
  readonly installationId: ExtensionInstanceId;
}

export function retainedExtensionCallbacks(
  owner: ReturnType<typeof createRetainedCompletionOwner>,
) {
  const capture = (extensionId: string, ids: readonly ElementId[]) =>
    captureRetainedExtensions(owner.readDocument(), extensionId, ids);
  return {
    captureExtensionInstall(extensionId: string, elementIds: readonly ElementId[]) {
      const snapshot = capture(extensionId, elementIds);
      if (!snapshot) return null;
      return owner.capture(
        "extension",
        snapshot,
        (saved, ids: readonly ExtensionInstallId[] | null) => {
          if (ids === null) return null;
          const missing = saved.updates.filter(({ from }) => !from);
          const byElement = new Map(ids.map((entry) => [entry.elementId, entry.installationId]));
          if (
            ids.length !== missing.length ||
            byElement.size !== ids.length ||
            missing.some(({ elementId }) => !byElement.has(elementId))
          )
            throw new Error("Invalid installation IDs");
          const parsed = saved.definition.parseConfiguration(saved.definition.createDefaultState());
          if (!parsed.ok) throw new Error("Invalid extension default");
          return extensionEditCommand(
            saved.canvasId,
            saved.updates.map((update) => ({
              ...update,
              to: update.from ?? {
                id: byElement.get(update.elementId)!,
                extensionId: saved.definition.id,
                target: { kind: "element" as const, elementId: update.elementId },
                enabled: true,
                configuration: parsed.configuration,
              },
            })),
          );
        },
      );
    },
    captureExtensionRemove(extensionId: string, elementIds: readonly ElementId[]) {
      const snapshot = capture(extensionId, elementIds);
      if (!snapshot) return null;
      return owner.capture("extension", snapshot, (saved, _input: void) =>
        extensionEditCommand(saved.canvasId, saved.updates),
      );
    },
    captureExtensionConfiguration(extensionId: string, elementId: ElementId) {
      const snapshot = capture(extensionId, [elementId]);
      if (!snapshot?.updates[0].from) return null;
      return owner.capture("extension", snapshot, (saved, configuration: unknown) => {
        if (configuration === null) return null;
        const parsed = saved.definition.parseConfiguration(configuration);
        if (!parsed.ok) throw new Error("Invalid extension configuration");
        return extensionEditCommand(
          saved.canvasId,
          saved.updates.map((update) => ({
            ...update,
            to: { ...update.from!, configuration: parsed.configuration },
          })),
        );
      });
    },
    // Activation is deliberately separate from a retained control's configuration.enabled.
    captureExtensionActivation(extensionId: string, elementId: ElementId) {
      const snapshot = capture(extensionId, [elementId]);
      if (!snapshot?.updates[0].from) return null;
      return owner.capture("extension", snapshot, (saved, enabled: boolean | null) => {
        if (enabled === null) return null;
        return extensionEditCommand(
          saved.canvasId,
          saved.updates.map((update) => ({
            ...update,
            to: { ...update.from!, enabled },
          })),
        );
      });
    },
    captureExtensionToggle(
      extensionId: "lock" | "privacy" | "checkbox",
      primaryId: ElementId,
      selectedIds: readonly ElementId[] = [],
    ) {
      const ids =
        extensionId === "lock" && selectedIds.includes(primaryId) ? selectedIds : [primaryId];
      const snapshot = capture(extensionId, ids);
      const primary = snapshot?.updates.find(({ elementId }) => elementId === primaryId)?.from;
      if (!snapshot || !primary) return null;
      const field = extensionId === "checkbox" ? "checked" : "enabled";
      const value = !primary.configuration[field];
      return owner.capture("extension", snapshot, (saved, _input: void) =>
        extensionEditCommand(
          saved.canvasId,
          saved.updates.map((update) => ({
            ...update,
            to: update.from
              ? {
                  ...update.from,
                  configuration: { ...update.from.configuration, [field]: value },
                }
              : null,
          })),
        ),
      );
    },
  };
}
