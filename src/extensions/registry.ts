import {
  IconArrowsShuffle,
  IconArrowsSort,
  IconCalendarRepeat,
  IconCards,
  IconCheckbox,
  IconChecklist,
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
  | "autoCheckbox"
  | "dailyReset"
  | "counter"
  | "inheritCardColor"
  | "pickCard";

export type ExtensionTargetType = "container" | "text-block" | "text-card" | "image";

export type ExtensionDefinition<Id extends ExtensionId = ExtensionId> = {
  id: Id;
  label: string;
  description: string;
  Icon: TablerIcon;
  targets: readonly ExtensionTargetType[];
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
    createDefault: () => ({ checked: false }),
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

export const isExtensionCompatible = (extensionId: ExtensionId, target: ExtensionTargetType) =>
  EXTENSION_COMPATIBLE_TARGETS[extensionId].has(target);
