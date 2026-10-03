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
  readonly updateAccent: (elementId: string, accent: string) => void;
  readonly rememberRecentColor: (color?: string) => void;
  readonly copyJsonForAi: (elementId: string) => Promise<void>;
  readonly pasteJsonFromAi: (elementId: string) => Promise<void>;
  readonly openJsonEditor: (elementId: string) => void;
}
