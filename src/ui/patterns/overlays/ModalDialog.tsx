import { IconX } from "@tabler/icons-react";
import { forwardRef, type ForwardedRef, type HTMLAttributes, type ReactNode } from "react";
import { MaterialSurface } from "../../materials/MaterialSurface";
import { IconButton } from "../../primitives";
import "./ModalDialog.css";

export interface ModalDialogProps extends HTMLAttributes<HTMLElement> {
  readonly width: number;
}

/** Major Glass dialog surface; compose with the header/body/actions parts below. */
export const ModalDialog = forwardRef<HTMLDivElement, ModalDialogProps>(function ModalDialog(
  { className, style, width, ...props },
  ref,
) {
  return (
    <MaterialSurface
      {...props}
      ref={ref as ForwardedRef<HTMLElement>}
      material="acrylic-large"
      radius={12}
      className={["taskmap-modal-dialog", className].filter(Boolean).join(" ")}
      style={{ ...style, width }}
    />
  );
});

export interface ModalDialogHeaderProps {
  readonly title: ReactNode;
  readonly titleId: string;
  readonly icon?: ReactNode;
  readonly onClose?: () => void;
  readonly closeDisabled?: boolean;
  /** Accessible name/tooltip for the close action; defaults to "Close". */
  readonly closeLabel?: string;
}

/** Shared dialog header: optional leading icon, title and a consistently aligned close action. */
export function ModalDialogHeader({
  closeDisabled,
  closeLabel = "Close",
  icon,
  onClose,
  title,
  titleId,
}: ModalDialogHeaderProps) {
  return (
    <div className="taskmap-modal-dialog__header">
      <div className="taskmap-modal-dialog__identity">
        {icon}
        <h2 id={titleId} className="taskmap-modal-dialog__title">
          {title}
        </h2>
      </div>
      {onClose ? (
        <IconButton
          icon={<IconX size={17} stroke={2} />}
          variant="ghost"
          size="compact"
          aria-label={closeLabel}
          title={closeLabel}
          onClick={onClose}
          disabled={closeDisabled}
        />
      ) : null}
    </div>
  );
}

export function ModalDialogBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={["taskmap-modal-dialog__body", className].filter(Boolean).join(" ")}
    />
  );
}

export function ModalDialogActions({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={["taskmap-modal-dialog__actions", className].filter(Boolean).join(" ")}
    />
  );
}
