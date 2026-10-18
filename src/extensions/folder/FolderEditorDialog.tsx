import { IconCheck, IconFolder, IconFolderOpen, IconX } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import {
  ModalDialog,
  ModalDialogActions,
  ModalDialogBody,
  ModalDialogHeader,
  useDialogFocus,
} from "../../ui/patterns/overlays";
import { Button } from "../../ui/primitives/Button";
import { Field } from "../../ui/primitives/Field";
import { TextField } from "../../ui/primitives/FormControls";
import { MAX_FOLDER_PATH_LENGTH, normalizeFolderPath } from "./folderDefinition";

export interface FolderEditorDialogProps {
  readonly cardName: string;
  readonly initialPath: string;
  readonly onChooseFolder: () => Promise<string | null>;
  readonly onSave: (path: string) => void;
  readonly onCancel: () => void;
}

/** Sets the folder a card opens: a pasted path, or one picked with the Windows folder picker. */
export function FolderEditorDialog({
  cardName,
  initialPath,
  onChooseFolder,
  onSave,
  onCancel,
}: FolderEditorDialogProps) {
  const [path, setPath] = useState(initialPath);
  const [choosing, setChoosing] = useState(false);
  const pathRef = useRef<HTMLInputElement>(null);
  const dialogRef = useDialogFocus(true, pathRef);

  useEffect(() => {
    pathRef.current?.select();
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onCancel();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onCancel]);

  const save = () => onSave(normalizeFolderPath(path));
  const browse = async () => {
    setChoosing(true);
    try {
      const chosen = await onChooseFolder();
      if (chosen) setPath(chosen);
    } finally {
      setChoosing(false);
    }
  };

  return (
    <ModalDialog
      ref={dialogRef}
      width={460}
      role="dialog"
      aria-modal="true"
      aria-labelledby="folder-editor-title"
      tabIndex={-1}
      data-production-dialog="folder-editor"
    >
      <ModalDialogHeader
        titleId="folder-editor-title"
        title={cardName ? `Folder for “${cardName}”` : "Folder"}
        icon={<IconFolder size={19} stroke={2} className="taskmap-modal-dialog__icon" />}
        onClose={onCancel}
      />
      <ModalDialogBody className="taskmap-modal-dialog__form">
        <Field label="Location">
          <div className="taskmap-folder-editor__row">
            <TextField
              ref={pathRef}
              value={path}
              maxLength={MAX_FOLDER_PATH_LENGTH}
              placeholder="C:\Users\you\Documents"
              spellCheck={false}
              onChange={(event) => setPath(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") save();
              }}
            />
            <Button
              variant="secondary"
              leadingIcon={<IconFolderOpen size={17} stroke={2} />}
              disabled={choosing}
              onClick={() => void browse()}
            >
              Browse…
            </Button>
          </div>
        </Field>
      </ModalDialogBody>
      <ModalDialogActions>
        <Button variant="ghost" leadingIcon={<IconX size={17} stroke={2} />} onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" leadingIcon={<IconCheck size={17} stroke={2} />} onClick={save}>
          Save
        </Button>
      </ModalDialogActions>
    </ModalDialog>
  );
}
