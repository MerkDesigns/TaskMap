import type { PointerEvent } from "react";
import {
  getMindmapConnectionPath,
  getMindmapConnectionPreviewPath,
  getMindmapPortPoint,
  type MindmapBounds,
  type MindmapPoint,
} from "../../mindmapMath";
import type { MindmapPort } from "../../types";
import type { MindMapDocumentConnection } from "./mindMapConnectionModel";
import "./mindMap.css";

/** A connection being drawn: to a target port once one is under the pointer, else to the pointer. */
export interface MindMapConnectionPreview {
  readonly source: MindmapPoint;
  readonly sourcePort: MindmapPort;
  readonly target: MindmapPoint;
  readonly targetPort?: MindmapPort;
}

export interface MindMapConnectionsProps {
  readonly connections: readonly MindMapDocumentConnection[];
  /** Shown bounds of every connectable element, including live move/resize previews. */
  readonly connectableBoundsById: ReadonlyMap<string, MindmapBounds>;
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  /** Connection mode makes lines clickable, to delete them. */
  readonly connectionMode: boolean;
  readonly preview?: MindMapConnectionPreview | null;
  readonly onConnectionClick: (event: PointerEvent<SVGPathElement>, connectionId: string) => void;
}

export function MindMapConnections({
  connections,
  connectableBoundsById,
  canvasWidth,
  canvasHeight,
  connectionMode,
  preview,
  onConnectionClick,
}: MindMapConnectionsProps) {
  return (
    <svg
      className="taskmap-mind-map-connections"
      width={canvasWidth}
      height={canvasHeight}
      aria-hidden="true"
    >
      {connections.map((connection) => {
        const { source, target } = connection;
        const sourceBounds = connectableBoundsById.get(source.elementId);
        const targetBounds = connectableBoundsById.get(target.elementId);
        if (!sourceBounds || !targetBounds) return null;
        const path = getMindmapConnectionPath(
          getMindmapPortPoint(sourceBounds, source.portId),
          source.portId,
          getMindmapPortPoint(targetBounds, target.portId),
          target.portId,
        );
        return (
          <g key={connection.id} className="taskmap-mind-map-connection">
            <path
              d={path}
              fill="none"
              stroke="rgba(220, 226, 235, 0.58)"
              strokeWidth={2}
              strokeLinecap="round"
            />
            {/* A wide transparent stroke makes the thin line easy to hit. */}
            <path
              data-mindmap-connection-id={connection.id}
              className="taskmap-mind-map-connection__hit"
              data-deletable={connectionMode || undefined}
              d={path}
              fill="none"
              stroke="transparent"
              strokeWidth={14}
              style={{ pointerEvents: connectionMode ? "stroke" : "none" }}
              onPointerDown={(event) => onConnectionClick(event, connection.id)}
            />
            {connectionMode && (
              <path
                data-mindmap-connection-delete-overlay={connection.id}
                className="taskmap-mind-map-connection__delete"
                d={path}
                fill="none"
                stroke="rgba(239, 68, 68, 0.95)"
                strokeWidth={4}
                strokeLinecap="round"
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
