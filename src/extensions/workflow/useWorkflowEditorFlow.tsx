import { useCallback, useRef, useState } from "react";
import { ModalPresence } from "../../ui/patterns/overlays";
import { WorkflowEditorDialog } from "./WorkflowEditorDialog";
import type { WorkflowStep } from "./workflowDefinition";

/** What the workflow editor needs from the application. */
export interface WorkflowEditorPort {
  /** The card's saved steps while the Workflow extension is installed on it, otherwise null. */
  readonly getSteps: (cardId: string) => readonly WorkflowStep[] | null;
  /** Stores the steps in the document; false when the card or extension changed meanwhile. */
  readonly saveSteps: (cardId: string, steps: WorkflowStep[]) => boolean;
  /** Records the definition as trusted on this device, since the user wrote it. */
  readonly trust: (steps: WorkflowStep[]) => Promise<boolean>;
}

/**
 * The Workflow extension's editor flow: one card's steps edited in a dialog, saved to the document
 * and trusted on this device.
 */
export function useWorkflowEditorFlow(port: WorkflowEditorPort) {
  const portRef = useRef(port);
  portRef.current = port;
  // Kept after closing until the exit animation completes, so the dialog does not empty mid-exit.
  const [editing, setEditing] = useState<{
    readonly cardId: string;
    readonly steps: readonly WorkflowStep[];
    readonly open: boolean;
  } | null>(null);

  const closeEditor = useCallback(
    () => setEditing((current) => (current ? { ...current, open: false } : null)),
    [],
  );

  const openWorkflowEditor = (cardId: string) => {
    const steps = portRef.current.getSteps(cardId);
    if (steps) setEditing({ cardId, steps, open: true });
  };

  const save = async (cardId: string, steps: WorkflowStep[]) => {
    if (!portRef.current.saveSteps(cardId, steps)) return false;
    // Saved even if trust cannot be recorded now; the card then offers a review instead of Run.
    await portRef.current.trust(steps);
    closeEditor();
    return true;
  };

  const editorDialog = (
    <ModalPresence
      open={Boolean(editing?.open && port.getSteps(editing.cardId))}
      onExitComplete={() => setEditing((current) => (current?.open ? current : null))}
    >
      {editing ? (
        <WorkflowEditorDialog
          key={editing.cardId}
          initialSteps={editing.steps}
          onSave={(steps) => save(editing.cardId, steps)}
          onClose={closeEditor}
        />
      ) : null}
    </ModalPresence>
  );

  return { openWorkflowEditor, closeEditor, editorDialog };
}
