import { IconCheck, IconPlus, IconX } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import {
  ModalDialog,
  ModalDialogActions,
  ModalDialogBody,
  ModalDialogHeader,
  useDialogFocus,
} from "../ui/patterns/overlays";
import { Button } from "../ui/primitives/Button";
import { CanvasDraftFields, type CanvasDraft } from "./CanvasDraftFields";

export interface CanvasCreateDialogProps {
  readonly initialDraft: CanvasDraft;
  readonly onCancel: () => void;
  readonly onCreate: (draft: CanvasDraft) => void;
}

/** Create Canvas: a Major Glass dialog on the shared dialog structure (UI guardrails section 2). */
export function CanvasCreateDialog({ initialDraft, onCancel, onCreate }: CanvasCreateDialogProps) {
  const [draft, setDraft] = useState(initialDraft);
  const nameRef = useRef<HTMLInputElement>(null);
  const dialogRef = useDialogFocus(true, nameRef);

  useEffect(() => {
    nameRef.current?.select();
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onCancel();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onCancel]);

  const submit = () => onCreate(draft);

  return (
    <ModalDialog
      ref={dialogRef}
      width={340}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-canvas-title"
      tabIndex={-1}
      data-production-dialog="create-canvas"
    >
      <ModalDialogHeader
        titleId="create-canvas-title"
        title="New canvas"
        icon={<IconPlus size={19} stroke={2} className="taskmap-modal-dialog__icon" />}
        onClose={onCancel}
      />
      <ModalDialogBody className="taskmap-modal-dialog__form">
        <CanvasDraftFields draft={draft} nameRef={nameRef} onChange={setDraft} onSubmit={submit} />
      </ModalDialogBody>
      <ModalDialogActions>
        <Button variant="ghost" leadingIcon={<IconX size={17} stroke={2} />} onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" leadingIcon={<IconCheck size={17} stroke={2} />} onClick={submit}>
          Create
        </Button>
      </ModalDialogActions>
    </ModalDialog>
  );
}
