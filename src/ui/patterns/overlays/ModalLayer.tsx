import { type ReactNode } from "react";
import { MaterialPlaneProvider } from "../../materials/MaterialPlane";
import "./ModalLayer.css";

export interface ModalLayerProps {
  readonly children: ReactNode;
}

export function ModalLayer({ children }: ModalLayerProps) {
  return (
    <MaterialPlaneProvider plane="modal">
      <div aria-hidden="true" className="taskmap-modal-scrim" />
      <div className="taskmap-modal-content-layer">{children}</div>
    </MaterialPlaneProvider>
  );
}
