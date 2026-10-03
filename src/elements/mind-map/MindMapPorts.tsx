import type { PointerEvent } from "react";
import type { MindmapPort } from "../../types";
import "./mindMap.css";

export interface MindMapPortsProps {
  readonly ownerId: string;
  readonly accent: string;
  readonly connectionMode: boolean;
  /** The port a connection is being drawn from, on its source element. */
  readonly activeSourcePort?: MindmapPort;
  /** The port the pointer is over, on a valid target element. */
  readonly activeTargetPort?: MindmapPort;
  readonly onStartConnection: (
    event: PointerEvent<HTMLButtonElement>,
    ownerId: string,
    port: MindmapPort,
  ) => void;
}

const PORTS: readonly MindmapPort[] = ["left", "right", "top", "bottom"];

/** The four connection ports of one connectable element. */
export function MindMapPorts({
  ownerId,
  accent,
  connectionMode,
  activeSourcePort,
  activeTargetPort,
  onStartConnection,
}: MindMapPortsProps) {
  return PORTS.map((port) => (
    <button
      key={port}
      type="button"
      className="taskmap-mind-map-port"
      data-port={port}
      data-mode={connectionMode || undefined}
      data-active={port === activeSourcePort || port === activeTargetPort || undefined}
      data-connection-port={port}
      data-connection-port-owner={ownerId}
      style={{ borderColor: accent }}
      onPointerDown={(event) => onStartConnection(event, ownerId, port)}
      aria-label={`${port} connection point`}
    />
  ));
}
