import type { RetainedExtensionKey } from "./retainedExtensionDefinition";

/**
 * The application commands extension UI contributions use, supplied once by the application and forwarded
 * by elements without inspection.
 */
export interface ExtensionCommands {
  /**
   * Flips an installed extension's flag: lock or privacy on/off (lock on the selection the element
   * is in), or a checkbox ticked/unticked.
   */
  readonly toggle: (extension: "lock" | "privacy" | "checkbox", elementId: string) => void;
  /** Removes an extension from the element, or from the selection the element is in. */
  readonly remove: (extension: RetainedExtensionKey, elementId: string) => void;
  /** Recolours just this element, as its header does. */
  readonly updateAccent: (elementId: string, accent: string) => void;
  /** Recolours the element, or the selection it is in, as its menu does. */
  readonly updateSelectionAccent: (elementId: string, accent: string) => void;
  readonly rememberRecentColor: (color?: string) => void;
  readonly setSearchQuery: (elementId: string, query: string) => void;
  readonly copyJsonForAi: (elementId: string) => Promise<void>;
  readonly pasteJsonFromAi: (elementId: string) => Promise<void>;
  readonly openJsonEditor: (elementId: string) => void;
}
