import type { RetainedExtensionDefinition } from "./retainedExtensionDefinition";
import { privacyDefinition } from "./privacy/privacyDefinition";
import { lockDefinition } from "./lock/lockDefinition";
import { colorPickerDefinition } from "./color-picker/colorPickerDefinition";
import { checkboxDefinition } from "./checkbox/checkboxDefinition";
import { searchDefinition } from "./search/searchDefinition";
import { autoCheckboxDefinition } from "./auto-checkbox/autoCheckboxDefinition";
import { counterDefinition } from "./counter/counterDefinition";
import { inheritCardColorDefinition } from "./inherit-card-color/inheritCardColorDefinition";
import { copyPasteJsonDefinition } from "./copy-paste-json/copyPasteJsonDefinition";
import { workflowDefinition } from "./workflow/workflowDefinition";
import { folderDefinition } from "./folder/folderDefinition";

// Registration order is the order the Extensions panel lists them in.
const registeredExtensionDefinitions: readonly RetainedExtensionDefinition[] = Object.freeze([
  privacyDefinition,
  lockDefinition,
  searchDefinition,
  checkboxDefinition,
  autoCheckboxDefinition,
  counterDefinition,
  inheritCardColorDefinition,
  copyPasteJsonDefinition,
  workflowDefinition,
  folderDefinition,
]);

/**
 * Extensions that became built-in features. Documents keep their installations, which still parse
 * so those documents open, but they are not offered, installable or shown anywhere.
 */
const retiredExtensionDefinitions: readonly RetainedExtensionDefinition[] = Object.freeze([
  colorPickerDefinition,
]);

/** The extensions people can install, in registration order. */
export function getArchitectureExtensionDefinitions(): readonly RetainedExtensionDefinition[] {
  return registeredExtensionDefinitions;
}

/** Any extension a document may hold, retired ones included. */
export function findArchitectureExtensionDefinition(
  id: string,
): RetainedExtensionDefinition | undefined {
  return [...registeredExtensionDefinitions, ...retiredExtensionDefinitions].find(
    (definition) => definition.id === id,
  );
}
