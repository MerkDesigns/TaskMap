import {
  IconArrowsShuffle,
  IconArrowsSort,
  IconCalendarRepeat,
  IconCards,
  IconBraces,
  IconCheckbox,
  IconChecklist,
  IconTerminal2,
  IconColorPicker,
  IconColorSwatch,
  IconLock,
  IconSearch,
  IconShieldLock,
  type Icon as TablerIcon,
} from "@tabler/icons-react";
import type { ElementExtensions } from "../types";
import { getLocalDateKey } from "../utils/date";

export type ExtensionId =
  | "privacy"
  | "lock"
  | "colorPicker"
  | "search"
  | "sorting"
  | "checkbox"
  | "commandRunner"
  | "autoCheckbox"
  | "dailyReset"
  | "counter"
  | "inheritCardColor"
  | "pickCard"
  | "copyPasteJson";

export type ExtensionTargetType = "container" | "text-block" | "text-card" | "image";

export type ExtensionDefinition<Id extends ExtensionId = ExtensionId> = {
  id: Id;
  label: string;
  description: string;
  Icon: TablerIcon;
  targets: readonly ExtensionTargetType[];
  conflicts?: readonly ExtensionId[];
  createDefault: () => NonNullable<ElementExtensions[Id]>;
};

const defineExtension = <Id extends ExtensionId>(definition: ExtensionDefinition<Id>) => definition;

export const EXTENSIONS = [
  defineExtension({
    id: "privacy",
    label: "Privacy",
    description: "Blur element content",
    Icon: IconShieldLock,
    targets: ["container", "text-block"],
    createDefault: () => ({ enabled: true }),
  }),
  defineExtension({
    id: "lock",
    label: "Lock",
    description: "Lock move, resize & deletion",
    Icon: IconLock,
    targets: ["container", "text-block", "text-card", "image"],
    createDefault: () => ({ enabled: true }),
  }),
  defineExtension({
    id: "colorPicker",
    label: "Extra colors",
    description: "Fine-tune and reuse accent colors",
    Icon: IconColorPicker,
    targets: ["container", "text-block"],
    createDefault: () => ({ enabled: true }),
  }),
  defineExtension({
    id: "search",
    label: "Search",
    description: "Filter container cards",
    Icon: IconSearch,
    targets: ["container"],
    createDefault: () => ({ query: "" }),
  }),
  defineExtension({
    id: "sorting",
    label: "Sorting",
    description: "Sort container cards",
    Icon: IconArrowsSort,
    targets: ["container"],
    createDefault: () => ({ mode: null, direction: "asc" }),
  }),
  defineExtension({
    id: "checkbox",
    label: "Checkbox",
    description: "Add checkable text cards",
    Icon: IconCheckbox,
    targets: ["text-card"],
    conflicts: ["commandRunner"],
    createDefault: () => ({ checked: false }),
  }),
  defineExtension({
    id: "commandRunner",
    label: "Command Runner",
    description: "Run saved commands",
    Icon: IconTerminal2,
    targets: ["text-card"],
    conflicts: ["checkbox"],
    createDefault: () => ({ commands: [] }),
  }),
  defineExtension({
    id: "autoCheckbox",
    label: "Auto checkboxes",
    description: "Checkboxes on new cards",
    Icon: IconChecklist,
    targets: ["container"],
    createDefault: () => ({ enabled: true }),
  }),
  defineExtension({
    id: "dailyReset",
    label: "Daily resets",
    description: "Reset card checkboxes daily",
    Icon: IconCalendarRepeat,
    targets: ["container"],
    createDefault: () => ({ lastResetDate: getLocalDateKey() }),
  }),
  defineExtension({
    id: "counter",
    label: "Counter",
    description: "Count cards in a container",
    Icon: IconCards,
    targets: ["container"],
    createDefault: () => ({ enabled: true }),
  }),
  defineExtension({
    id: "inheritCardColor",
    label: "Inherit color",
    description: "New cards inherit color",
    Icon: IconColorSwatch,
    targets: ["container"],
    createDefault: () => ({ enabled: true }),
  }),
  defineExtension({
    id: "pickCard",
    label: "Pick a card",
    description: "Show one random card",
    Icon: IconArrowsShuffle,
    targets: ["container"],
    createDefault: () => ({}),
  }),
  defineExtension({
    id: "copyPasteJson",
    label: "Copy/Paste JSON",
    description: "Edit cards with AI",
    Icon: IconBraces,
    targets: ["container"],
    createDefault: () => ({ enabled: true }),
  }),
] as const satisfies readonly ExtensionDefinition[];

export const EXTENSION_REGISTRY = Object.fromEntries(
  EXTENSIONS.map((extension) => [extension.id, extension]),
) as { [Id in ExtensionId]: Extract<(typeof EXTENSIONS)[number], { id: Id }> };

export const EXTENSION_DROP_ICONS = EXTENSIONS.reduce(
  (icons, { id, Icon }) => {
    icons[id] = Icon;
    return icons;
  },
  {} as Record<ExtensionId, TablerIcon>,
);

export const EXTENSION_COMPATIBLE_TARGETS = EXTENSIONS.reduce(
  (compatibility, { id, targets }) => {
    compatibility[id] = new Set<ExtensionTargetType>(targets);
    return compatibility;
  },
  {} as Record<ExtensionId, ReadonlySet<ExtensionTargetType>>,
);

export const EXTENSION_CONFLICTS = EXTENSIONS.reduce(
  (conflicts, extension) => {
    conflicts[extension.id] = new Set<ExtensionId>(
      "conflicts" in extension ? extension.conflicts : [],
    );
    return conflicts;
  },
  {} as Record<ExtensionId, ReadonlySet<ExtensionId>>,
);

export const isExtensionCompatible = (extensionId: ExtensionId, target: ExtensionTargetType) =>
  EXTENSION_COMPATIBLE_TARGETS[extensionId].has(target);

export const addAutomaticCheckbox = (extensions?: ElementExtensions): ElementExtensions => {
  const hasConflict = [...EXTENSION_CONFLICTS.checkbox].some(
    (extensionId) => extensions?.[extensionId] !== undefined,
  );
  if (hasConflict) {
    return { ...extensions };
  }
  return {
    ...extensions,
    checkbox: extensions?.checkbox ?? EXTENSION_REGISTRY.checkbox.createDefault(),
  };
};
