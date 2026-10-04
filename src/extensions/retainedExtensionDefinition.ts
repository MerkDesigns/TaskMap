import type { Icon as TablerIcon } from "@tabler/icons-react";
import type { JsonObject } from "../domain/document/documentTypes";
import type { ElementExtensions } from "../types";
import type { ExtensionDefinition } from "./extensionDefinition";

export type RetainedExtensionKey =
  | "privacy"
  | "lock"
  | "colorPicker"
  | "checkbox"
  | "search"
  | "autoCheckbox"
  | "counter"
  | "inheritCardColor"
  | "copyPasteJson";
export type RetainedExtensionView = {
  readonly [Key in RetainedExtensionKey]?: Readonly<NonNullable<ElementExtensions[Key]>>;
};

/** How the Extensions panel and quick menu present an extension. */
export interface ExtensionCatalogInfo {
  readonly title: string;
  readonly description: string;
  readonly Icon: TablerIcon;
}

export interface RetainedExtensionDefinition extends ExtensionDefinition {
  readonly viewKey: RetainedExtensionKey;
  readonly catalog: ExtensionCatalogInfo;
  readonly parseConfiguration: (input: unknown) =>
    | { readonly ok: false }
    | {
        readonly ok: true;
        readonly configuration: JsonObject;
        readonly view: RetainedExtensionView;
      };
}

// A typed compatibility projection attached to the existing registry definition, not a renderer.
export function defineRetainedExtension<Key extends RetainedExtensionKey>(
  definition: Omit<ExtensionDefinition<NonNullable<ElementExtensions[Key]>>, "Control"> & {
    readonly viewKey: Key;
    readonly catalog: ExtensionCatalogInfo;
  },
): RetainedExtensionDefinition {
  return Object.freeze({
    ...definition,
    compatibleElementTypes: Object.freeze([...definition.compatibleElementTypes]),
    conflictsWith: Object.freeze([...definition.conflictsWith]),
    catalog: Object.freeze({ ...definition.catalog }),
    parseConfiguration(input: unknown) {
      const result = definition.stateSchema.safeParse(input);
      if (!result.success) return { ok: false as const };
      const configuration = Object.freeze(
        result.data as NonNullable<ElementExtensions[RetainedExtensionKey]>,
      );
      return {
        ok: true as const,
        configuration,
        view: Object.freeze({ [definition.viewKey]: configuration }) as RetainedExtensionView,
      };
    },
  });
}
