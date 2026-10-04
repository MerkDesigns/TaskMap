import type { Icon as TablerIcon } from "@tabler/icons-react";
import { getArchitectureExtensionDefinitions } from "./architectureRegistry";
import type { RetainedExtensionKey } from "./retainedExtensionDefinition";

/** The element kinds the Extensions panel filters by; mind-map nodes are shown as "mindmap". */
export type ExtensionTargetType = "container" | "text-block" | "text-card" | "mindmap" | "image";

/** An installable extension as the Extensions panel, quick menu and drop targets present it. */
export interface ExtensionCatalogEntry {
  readonly id: RetainedExtensionKey;
  readonly label: string;
  readonly description: string;
  readonly Icon: TablerIcon;
  readonly targets: readonly ExtensionTargetType[];
}

const targetType = (elementType: string): ExtensionTargetType | null =>
  elementType === "mind-map-node"
    ? "mindmap"
    : ((["container", "text-block", "text-card", "image"] as const).find(
        (type) => type === elementType,
      ) ?? null);

/** Every registered extension, in registration order, presented from its definition. */
export const EXTENSIONS: readonly ExtensionCatalogEntry[] = Object.freeze(
  getArchitectureExtensionDefinitions().map((definition) =>
    Object.freeze({
      id: definition.viewKey,
      label: definition.catalog.title,
      description: definition.catalog.description,
      Icon: definition.catalog.Icon,
      targets: Object.freeze(
        definition.compatibleElementTypes.flatMap((type) => targetType(type) ?? []),
      ),
    }),
  ),
);

const entries = new Map(EXTENSIONS.map((entry) => [entry.id, entry]));

export function extensionCatalogEntry(id: RetainedExtensionKey): ExtensionCatalogEntry {
  const entry = entries.get(id);
  if (!entry) throw new Error(`Unknown extension ${id}`);
  return entry;
}

export const isExtensionCompatible = (id: RetainedExtensionKey, target: ExtensionTargetType) =>
  extensionCatalogEntry(id).targets.includes(target);
