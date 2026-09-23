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

const registeredExtensionDefinitions: readonly RetainedExtensionDefinition[] = Object.freeze([
  privacyDefinition,
  lockDefinition,
  colorPickerDefinition,
  checkboxDefinition,
  searchDefinition,
  autoCheckboxDefinition,
  counterDefinition,
  inheritCardColorDefinition,
  copyPasteJsonDefinition,
]);

export function getArchitectureExtensionDefinitions(): readonly RetainedExtensionDefinition[] {
  return registeredExtensionDefinitions;
}

export function findArchitectureExtensionDefinition(
  id: string,
): RetainedExtensionDefinition | undefined {
  return registeredExtensionDefinitions.find((definition) => definition.id === id);
}
