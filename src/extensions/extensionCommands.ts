import type { RetainedExtensionKey } from "./retainedExtensionDefinition";
import type { CardWorkflowRun } from "./workflow/workflowRunStore";

export type FolderOpenResult = "opened" | "missing" | "failed";

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
  readonly openWorkflowEditor: (cardId: string) => void;
  readonly runWorkflow: (cardId: string) => Promise<void>;
  readonly stopWorkflow: (cardId: string) => Promise<void>;
  /** The cards' workflow runs as an external store, for the run buttons. */
  readonly subscribeWorkflowRuns: (listener: () => void) => () => void;
  readonly getWorkflowRun: (cardId: string) => CardWorkflowRun | null;
  /** Opens the dialog that sets the card's folder. */
  readonly openFolderEditor: (cardId: string) => void;
  /** Opens the card's folder in Explorer; "missing" when the folder does not exist. */
  readonly openFolder: (cardId: string) => Promise<FolderOpenResult>;
}
