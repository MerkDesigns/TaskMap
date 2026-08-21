import { forwardRef, type ForwardedRef, type HTMLAttributes } from "react";
import { MaterialSurface } from "../../materials/MaterialSurface";
import "./ModalDialog.css";

export interface ModalDialogProps extends HTMLAttributes<HTMLElement> {
  readonly width: number;
}

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
