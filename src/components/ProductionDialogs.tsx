import {
  IconDownload,
  IconRotateClockwise,
  IconTrash,
  IconUpload,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import type { AppUpdateInfo } from "../types";
import { Button, TextField } from "../ui/primitives";
import {
  ModalDialog,
  ModalDialogActions,
  ModalDialogBody,
  ModalDialogHeader,
  useDialogFocus,
} from "../ui/patterns/overlays";

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
      <ModalDialogHeader
        titleId="update-available-title"
        title="Update available"
        icon={<IconDownload size={19} stroke={2} className="taskmap-modal-dialog__icon" />}
        onClose={onDismiss}
        closeDisabled={busy}
      />
      <ModalDialogBody>
        <div>TaskMap {update.version} is ready to download.</div>
        <div className="taskmap-modal-dialog__secondary">
          Current version: {update.currentVersion}
        </div>
        {error ? <div className="taskmap-modal-dialog__error">{error}</div> : null}
      </ModalDialogBody>
      <ModalDialogActions>
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
      </ModalDialogActions>
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
      <ModalDialogHeader
        titleId="clear-canvas-title"
        title="Clear canvas?"
        icon={<IconTrash size={19} stroke={2} className="taskmap-modal-dialog__danger-icon" />}
        onClose={onCancel}
      />
      <ModalDialogBody>
        <p>This will remove all content from the canvas, including locked items.</p>
      </ModalDialogBody>
      <ModalDialogActions>
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
      </ModalDialogActions>
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
      <ModalDialogHeader
        titleId="data-password-title"
        title={exporting ? "Export data" : "Import data"}
        icon={<DialogIcon size={19} stroke={2} className="taskmap-modal-dialog__icon" />}
        onClose={onClose}
      />
      <ModalDialogBody>
        <TextField
          ref={passwordRef}
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
      </ModalDialogBody>
      <ModalDialogActions>
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
      </ModalDialogActions>
    </ModalDialog>
  );
}
