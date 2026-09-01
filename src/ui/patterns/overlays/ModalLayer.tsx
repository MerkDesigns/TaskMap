import { forwardRef, type ReactNode, type RefObject } from "react";
import { MaterialPlaneProvider } from "../../materials/MaterialPlane";
import "./ModalLayer.css";

export interface ModalLayerProps {
  readonly children: ReactNode;
  readonly groupRef: RefObject<HTMLDivElement | null>;
  readonly materialAware?: boolean;
  readonly phase: string;
  readonly scrimRef: RefObject<HTMLDivElement | null>;
}

export function ModalLayer({ children, groupRef, materialAware, phase, scrimRef }: ModalLayerProps) {
  return (
    <MaterialPlaneProvider plane="modal">
      <div ref={scrimRef} aria-hidden="true" className="taskmap-modal-scrim" />
      <div className="taskmap-modal-content-layer">
        <ModalPresenceGroup
          ref={groupRef}
          level="root"
          materialAware={materialAware}
          phase={phase}
        >
          {children}
        </ModalPresenceGroup>
      </div>
    </MaterialPlaneProvider>
  );
}

export function NestedModalLayer({
  children,
  groupRef,
  materialAware,
  phase,
  scrimRef,
}: ModalLayerProps) {
  return (
    <div className="taskmap-nested-modal-layer">
      <div ref={scrimRef} aria-hidden="true" className="taskmap-nested-modal-scrim" />
      <div className="taskmap-nested-modal-content">
        <ModalPresenceGroup
          ref={groupRef}
          level="nested"
          materialAware={materialAware}
          phase={phase}
        >
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
    readonly materialAware?: boolean;
    readonly phase: string;
  }
>(function ModalPresenceGroup({ children, level, materialAware, phase }, ref) {
  return (
    <div
      ref={ref}
      className="taskmap-modal-presence-group"
      data-material-aware-presence={materialAware || undefined}
      data-motion-state={phase}
      data-taskmap-modal-presence-level={level}
      data-taskmap-modal-presence-blocking="true"
    >
      {children}
    </div>
  );
});
