import { forwardRef, type ReactNode, type RefObject } from "react";
import { MaterialPlaneProvider } from "../../materials/MaterialPlane";
import "./ModalLayer.css";

export interface ModalLayerProps {
  readonly children: ReactNode;
  readonly groupRef: RefObject<HTMLDivElement>;
  readonly phase: string;
  readonly scrimRef: RefObject<HTMLDivElement>;
}

export function ModalLayer({ children, groupRef, phase, scrimRef }: ModalLayerProps) {
  return (
    <MaterialPlaneProvider plane="modal">
      <div ref={scrimRef} aria-hidden="true" className="taskmap-modal-scrim" />
      <div className="taskmap-modal-content-layer">
        <ModalPresenceGroup ref={groupRef} level="root" phase={phase}>
          {children}
        </ModalPresenceGroup>
      </div>
    </MaterialPlaneProvider>
  );
}

export function NestedModalLayer({ children, groupRef, phase, scrimRef }: ModalLayerProps) {
  return (
    <div className="taskmap-nested-modal-layer">
      <div ref={scrimRef} aria-hidden="true" className="taskmap-nested-modal-scrim" />
      <div className="taskmap-nested-modal-content">
        <ModalPresenceGroup ref={groupRef} level="nested" phase={phase}>
          {children}
        </ModalPresenceGroup>
      </div>
    </div>
  );
}

const ModalPresenceGroup = forwardRef<
  HTMLDivElement,
  {
    readonly children: ReactNode;
    readonly level: "root" | "nested";
    readonly phase: string;
  }
>(function ModalPresenceGroup({ children, level, phase }, ref) {
  return (
    <div
      ref={ref}
      className="taskmap-modal-presence-group"
      data-motion-state={phase}
      data-taskmap-modal-presence-level={level}
      data-taskmap-modal-presence-blocking="true"
    >
      {children}
    </div>
  );
});
