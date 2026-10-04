import { getArchitectureExtensionDefinitions } from "./architectureRegistry";
import { colorPickerMenuItem } from "./color-picker/colorPickerMenuItem";
import { lockMenuItem } from "./lock/lockMenuItem";
import { workflowMenuItem } from "./workflow/workflowMenuItem";
import type { ExtensionMenuItem, MenuItemContext } from "./menuItem";
import type { RetainedExtensionKey } from "./retainedExtensionDefinition";

/** Extension menu items in display order. */
const menuItems: readonly ExtensionMenuItem[] = Object.freeze([
  colorPickerMenuItem,
  workflowMenuItem,
  lockMenuItem,
]);

/** The order extensions are listed in a menu's "Remove Extensions" section. */
const removalOrder: readonly RetainedExtensionKey[] = Object.freeze([
  "privacy",
  "search",
  "lock",
  "colorPicker",
  "checkbox",
  "autoCheckbox",
  "counter",
  "inheritCardColor",
  "copyPasteJson",
  "workflow",
]);

/** The items an element's menu shows: offered for its type, installed on any menu target. */
export function menuItemsFor(context: MenuItemContext): readonly ExtensionMenuItem[] {
  return menuItems.filter(
    (item) => item.hosts.includes(context.host) && context.installedOnTargets.has(item.extension),
  );
}

export interface RemovableExtension {
  readonly extension: RetainedExtensionKey;
  readonly label: string;
}

/** The extensions a menu offers to remove from its targets, labelled by their definitions. */
export function removableExtensionsFor(
  installedOnTargets: ReadonlySet<RetainedExtensionKey>,
): readonly RemovableExtension[] {
  const definitions = getArchitectureExtensionDefinitions();
  return removalOrder.flatMap((extension) => {
    const definition = definitions.find((candidate) => candidate.viewKey === extension);
    return installedOnTargets.has(extension) && definition
      ? [{ extension, label: definition.label }]
      : [];
  });
}
