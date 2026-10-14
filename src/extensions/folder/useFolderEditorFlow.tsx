import { useCallback, useRef, useState } from "react";
import { ModalPresence } from "../../ui/patterns/overlays";
import { FolderEditorDialog } from "./FolderEditorDialog";

/** What the folder dialog needs from the application. */
export interface FolderEditorPort {
  /** The card's folder while the Folder extension is installed on it, otherwise null. */
  readonly getPath: (cardId: string) => string | null;
  readonly getCardName: (cardId: string) => string;
  /** Stores the path in the document; false when the card or extension changed meanwhile. */
  readonly savePath: (cardId: string, path: string) => boolean;
  readonly chooseFolder: () => Promise<string | null>;
}

/** The Folder extension's dialog flow: one card's folder path, set in a small dialog. */
export function useFolderEditorFlow(port: FolderEditorPort) {
  const portRef = useRef(port);
  portRef.current = port;
  const [editing, setEditing] = useState<{
    readonly cardId: string;
    readonly cardName: string;
    readonly path: string;
    readonly session: number;
  } | null>(null);
  const [open, setOpen] = useState(false);
  const sessions = useRef(0);

  const closeEditor = useCallback(() => setOpen(false), []);

  const openFolderEditor = (cardId: string) => {
    const path = portRef.current.getPath(cardId);
    if (path === null) return;
    setEditing({
      cardId,
      cardName: portRef.current.getCardName(cardId),
      path,
      session: ++sessions.current,
    });
    setOpen(true);
  };

  // The dialog keeps its last card while it fades out after closing.
  const editorDialog = editing ? (
    <ModalPresence open={open && port.getPath(editing.cardId) !== null}>
      <FolderEditorDialog
        key={editing.session}
        cardName={editing.cardName}
        initialPath={editing.path}
        onChooseFolder={() => portRef.current.chooseFolder()}
        onSave={(path) => {
          if (portRef.current.savePath(editing.cardId, path)) closeEditor();
        }}
        onCancel={closeEditor}
      />
    </ModalPresence>
  ) : null;

  return { openFolderEditor, closeEditor, editorDialog };
}
