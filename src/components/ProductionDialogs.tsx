import {
  IconDownload,
  IconRotateClockwise,
  IconTrash,
  IconUpload,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import type { AppUpdateInfo } from "../types";
import { Button, IconButton, TextField } from "../ui/primitives";
import { ModalDialog, useDialogFocus } from "../ui/patterns/overlays";

export interface UpdateAvailableModalProps {
  readonly update: AppUpdateInfo;
  readonly onInstall: () => Promise<void>;
  readonly onDismiss: () => void;
}

export function UpdateAvailableModal({ update, onInstall, onDismiss }: UpdateAvailableModalProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useDialogFocus();

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || busy) return;
      event.preventDefault();
      onDismiss();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [busy, onDismiss]);

  const handleInstall = async () => {
    setError("");
    setBusy(true);
    try {
      await onInstall();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setBusy(false);
    }
  };

  return (
    <ModalDialog
      ref={dialogRef}
      width={380}
      role="dialog"
      aria-modal="true"
      aria-labelledby="update-available-title"
      tabIndex={-1}
      data-production-dialog="update"
    >
      <div className="taskmap-modal-dialog__header">
        <div className="taskmap-modal-dialog__identity">
          <IconDownload size={19} stroke={2} className="taskmap-modal-dialog__icon" />
          <h2 id="update-available-title" className="taskmap-modal-dialog__title">
            Update available
          </h2>
        </div>
        <IconButton
          icon={<IconX size={17} stroke={2} />}
          variant="ghost"
          size="compact"
          aria-label="Close"
          title="Close"
          onClick={onDismiss}
          disabled={busy}
        />
      </div>
      <div className="taskmap-modal-dialog__body">
        <div>TaskMap {update.version} is ready to download.</div>
        <div className="taskmap-modal-dialog__secondary">
          Current version: {update.currentVersion}
        </div>
        {error ? <div className="taskmap-modal-dialog__error">{error}</div> : null}
      </div>
      <div className="taskmap-modal-dialog__actions">
        <Button
          variant="ghost"
          leadingIcon={<IconX size={17} stroke={2} />}
          onClick={onDismiss}
          disabled={busy}
        >
          Not now
        </Button>
        <Button
          variant="primary"
          leadingIcon={<IconDownload size={17} stroke={2} />}
          onClick={handleInstall}
          disabled={busy}
        >
          {busy ? "Installing..." : "Update"}
        </Button>
      </div>
    </ModalDialog>
  );
}

export interface ClearCanvasModalProps {
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

export function ClearCanvasModal({ onCancel, onConfirm }: ClearCanvasModalProps) {
  const dialogRef = useDialogFocus();

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onCancel();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onCancel]);

  return (
    <ModalDialog
      ref={dialogRef}
      width={360}
      role="dialog"
      aria-modal="true"
      aria-labelledby="clear-canvas-title"
      tabIndex={-1}
      data-production-dialog="clear-canvas"
    >
      <div className="taskmap-modal-dialog__identity">
        <IconTrash size={20} stroke={2} className="taskmap-modal-dialog__danger-icon" />
        <h2 id="clear-canvas-title" className="taskmap-modal-dialog__title">
          Clear canvas?
        </h2>
      </div>
      <p className="taskmap-modal-dialog__body taskmap-modal-dialog__clear-copy">
        This will remove all content from the canvas, including locked items.
      </p>
      <div className="taskmap-modal-dialog__actions">
        <Button variant="ghost" leadingIcon={<IconX size={17} stroke={2} />} onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="danger"
          leadingIcon={<IconRotateClockwise size={17} stroke={2} />}
          onClick={onConfirm}
        >
          Clear
        </Button>
      </div>
    </ModalDialog>
  );
}

export interface SettingsPasswordDialogProps {
  readonly busy: boolean;
  readonly mode: "export" | "import";
  readonly password: string;
  readonly onClose: () => void;
  readonly onPasswordChange: (password: string) => void;
  readonly onSubmit: () => void;
}

export function SettingsPasswordDialog({
  busy,
  mode,
  onClose,
  onPasswordChange,
  onSubmit,
  password,
}: SettingsPasswordDialogProps) {
  const passwordRef = useRef<HTMLInputElement>(null);
  const dialogRef = useDialogFocus(true, passwordRef);
  const exporting = mode === "export";
  const DialogIcon = exporting ? IconDownload : IconUpload;

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return (
    <ModalDialog
      ref={dialogRef}
      width={340}
      role="dialog"
      aria-modal="true"
      aria-labelledby="data-password-title"
      tabIndex={-1}
      data-production-dialog="password"
    >
      <div className="taskmap-modal-dialog__header">
        <div className="taskmap-modal-dialog__identity">
          <DialogIcon size={19} stroke={2} className="taskmap-modal-dialog__icon" />
          <h2 id="data-password-title" className="taskmap-modal-dialog__title">
            {exporting ? "Export data" : "Import data"}
          </h2>
        </div>
        <IconButton
          icon={<IconX size={17} stroke={2} />}
          variant="ghost"
          size="compact"
          aria-label="Close"
          title="Close"
          onClick={onClose}
        />
      </div>
      <TextField
        ref={passwordRef}
        className="taskmap-modal-dialog__password"
        type="password"
        value={password}
        autoFocus
        spellCheck={false}
        onChange={(event) => onPasswordChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") onSubmit();
        }}
        placeholder="Password"
      />
      <div className="taskmap-modal-dialog__actions">
        <Button variant="ghost" leadingIcon={<IconX size={17} stroke={2} />} onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          leadingIcon={<DialogIcon size={17} stroke={2} />}
          onClick={onSubmit}
          disabled={busy}
        >
          {exporting ? "Export" : "Import"}
        </Button>
      </div>
    </ModalDialog>
  );
}
