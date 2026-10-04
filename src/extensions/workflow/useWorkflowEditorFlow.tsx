import { useCallback, useRef, useState } from "react";
import { WorkflowEditorWindow } from "./WorkflowEditorWindow";
import type { WorkflowLine } from "./workflowDefinition";

/** What the workflow editor needs from the application. */
export interface WorkflowEditorPort {
  /** The card's saved lines while the Workflow extension is installed on it, otherwise null. */
  readonly getLines: (cardId: string) => readonly WorkflowLine[] | null;
  readonly getCardName: (cardId: string) => string;
  /** Stores the lines in the document; false when the card or extension changed meanwhile. */
  readonly saveLines: (cardId: string, lines: WorkflowLine[]) => boolean;
  /** Renames the card; false when it could not be renamed. */
  readonly saveCardName: (cardId: string, name: string) => boolean;
  /** Records the definition as trusted on this device, since the user wrote it. */
  readonly trust: (lines: WorkflowLine[]) => Promise<boolean>;
  readonly chooseFolder: () => Promise<string | null>;
}

/**
 * The Workflow extension's editor flow: one card's command lines edited in a floating window, saved
 * to the document and trusted on this device.
 */
export function useWorkflowEditorFlow(port: WorkflowEditorPort) {
  const portRef = useRef(port);
  portRef.current = port;
  const [editing, setEditing] = useState<{
    readonly cardId: string;
    readonly cardName: string;
    readonly lines: readonly WorkflowLine[];
  } | null>(null);

  const closeEditor = useCallback(() => setEditing(null), []);

  const openWorkflowEditor = (cardId: string) => {
    const lines = portRef.current.getLines(cardId);
    if (lines) setEditing({ cardId, cardName: portRef.current.getCardName(cardId), lines });
  };

  const save = async (
    cardId: string,
    previousName: string,
    name: string,
    lines: WorkflowLine[],
  ) => {
    if (!portRef.current.saveLines(cardId, lines)) return false;
    if (name !== previousName) portRef.current.saveCardName(cardId, name);
    // Saved even if trust cannot be recorded now; the card then offers a review instead of Run.
    await portRef.current.trust(lines);
    return true;
  };

  const editorWindow =
    editing && port.getLines(editing.cardId) ? (
      <WorkflowEditorWindow
        key={editing.cardId}
        cardName={editing.cardName}
        initialLines={editing.lines}
        onSave={(name, lines) => save(editing.cardId, editing.cardName, name, lines)}
        onChooseFolder={() => portRef.current.chooseFolder()}
        onClose={closeEditor}
      />
    ) : null;

  return { openWorkflowEditor, closeEditor, editorWindow };
}
