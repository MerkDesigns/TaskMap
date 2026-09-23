import type { ExtensionInstallation } from "../../domain/document/documentTypes";
import type { ElementId, ExtensionInstanceId } from "../../domain/ids/entityIds";
import { checkboxDefinition } from "../../extensions/checkbox/checkboxDefinition";
import { containerHasExtension, type RetainedContainerSnapshot } from "./retainedContainerSnapshot";

export function automaticCardCheckbox(
  snapshot: RetainedContainerSnapshot,
  cardId: ElementId,
  installations: readonly ExtensionInstallation[],
  proposedId: ExtensionInstanceId | null,
): ExtensionInstallation | null {
  // Preserve copied checked state AND activation; never add a duplicate over an inactive checkbox.
  const needed =
    containerHasExtension(snapshot, "auto-checkbox") &&
    !installations.some((entry) => entry.extensionId === checkboxDefinition.id);
  if (!needed) {
    if (proposedId !== null) throw new Error("Unexpected checkbox ID");
    return null;
  }
  if (proposedId === null) throw new Error("Missing checkbox ID");
  const parsed = checkboxDefinition.parseConfiguration(checkboxDefinition.createDefaultState());
  if (!parsed.ok) throw new Error("Invalid checkbox default");
  return {
    id: proposedId,
    extensionId: checkboxDefinition.id,
    enabled: true,
    target: { kind: "element", elementId: cardId },
    configuration: parsed.configuration,
  };
}
