import type { PointerEvent } from "react";
import {
  getMindmapConnectionPath,
  getMindmapConnectionPreviewPath,
  getMindmapPortPoint,
  type MindmapBounds,
  type MindmapPoint,
} from "../mindmapMath";
import type { MindmapConnection, MindmapPort } from "../types";

type ConnectionPreview = {
  source: MindmapPoint;
  sourcePort: MindmapPort;
  target: MindmapPoint;
  targetPort?: MindmapPort;
};

type MindmapConnectionsProps = {
  connections: MindmapConnection[];
  connectableBoundsById: Map<string, MindmapBounds>;
  canvasWidth: number;
  canvasHeight: number;
  connectionMode: boolean;
  preview?: ConnectionPreview | null;
  onConnectionClick: (event: PointerEvent<SVGPathElement>, connection: MindmapConnection) => void;
};

export function MindmapConnections({
  connections,
  connectableBoundsById,
  canvasWidth,
  canvasHeight,
  connectionMode,
  preview,
  onConnectionClick,
}: MindmapConnectionsProps) {
  return (
    <svg
      className="pointer-events-none absolute left-0 top-0 z-[5] overflow-visible"
      width={canvasWidth}
      height={canvasHeight}
      aria-hidden="true"
    >
      {connections.map((connection) => {
        const source = connectableBoundsById.get(connection.sourceId);
        const target = connectableBoundsById.get(connection.targetId);
        if (!source || !target) return null;
        const path = getMindmapConnectionPath(
          getMindmapPortPoint(source, connection.sourcePort),
          connection.sourcePort,
          getMindmapPortPoint(target, connection.targetPort),
          connection.targetPort,
        );
        return (
          <g key={connection.id} className={connectionMode ? "group" : undefined}>
            <path
              d={path}
              fill="none"
              stroke="rgba(220, 226, 235, 0.58)"
              strokeWidth={2}
              strokeLinecap="round"
            />
            <path
              data-mindmap-connection-id={connection.id}
              d={path}
              fill="none"
              stroke="transparent"
              strokeWidth={14}
              className={connectionMode ? "cursor-pointer" : undefined}
              style={{ pointerEvents: connectionMode ? "stroke" : "none" }}
              onPointerDown={(event) => onConnectionClick(event, connection)}
            />
            {connectionMode && (
              <path
                data-mindmap-connection-delete-overlay={connection.id}
                d={path}
                fill="none"
                stroke="rgba(239, 68, 68, 0.95)"
                strokeWidth={4}
                strokeLinecap="round"
                className="pointer-events-none opacity-0 transition-opacity duration-100 group-hover:opacity-100"
              />
            )}
          </g>
        );
      })}
      {preview && (
        <path
          d={
            preview.targetPort
              ? getMindmapConnectionPath(
                  preview.source,
                  preview.sourcePort,
                  preview.target,
                  preview.targetPort,
                )
              : getMindmapConnectionPreviewPath(preview.source, preview.sourcePort, preview.target)
          }
          fill="none"
          stroke="rgba(235, 240, 248, 0.72)"
          strokeWidth={2}
          strokeDasharray="6 5"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
