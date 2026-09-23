import type { ConnectionId, ElementId } from "../../domain/ids/entityIds";
import type { ElementGeometry } from "../../domain/document/documentTypes";
import {
  mindMapPortSchema,
  mindMapConnectionSchema,
  type MindMapDocumentConnection,
} from "../../elements/mind-map/mindMapConnectionModel";
import type { MindMapNodeData } from "../../elements/mind-map/mindMapModel";
import type { createRetainedCompletionOwner } from "./retainedCompletionOwner";
import { oppositeMindMapPort } from "./retainedConnectionCommands";

export type ConnectionCompletion =
  | {
      readonly connectionId: ConnectionId;
      readonly target: MindMapDocumentConnection["target"];
    }
  | {
      readonly connectionId: ConnectionId;
      readonly newNode: {
        readonly id: ElementId;
        readonly geometry: ElementGeometry;
        readonly data: MindMapNodeData;
      };
    }
  | null;

// Same bounded callback owner, no additional document/session observers or pointer-state owner.
export function retainedConnectionCallbacks(
  owner: ReturnType<typeof createRetainedCompletionOwner>,
) {
  return {
    captureConnection(sourceId: ElementId, port: string) {
      const document = owner.readDocument();
      const source = document?.elements[sourceId];
      const parsedPort = mindMapPortSchema.safeParse(port);
      if (
        !document?.activeCanvasId ||
        source?.canvasId !== document.activeCanvasId ||
        !parsedPort.success
      )
        return null;
      return owner.capture(
        "connection",
        {
          canvasId: document.activeCanvasId,
          source: { elementId: sourceId, portId: parsedPort.data },
        },
        (snapshot, completion: ConnectionCompletion) => {
          if (completion === null) return null;
          if ("newNode" in completion === "target" in completion)
            throw new Error("Invalid connection completion");
          const newNode =
            "newNode" in completion
              ? {
                  ...completion.newNode,
                  canvasId: snapshot.canvasId,
                  type: "mind-map-node" as const,
                }
              : undefined;
          const target =
            "target" in completion
              ? completion.target
              : {
                  elementId: completion.newNode.id,
                  portId: oppositeMindMapPort[snapshot.source.portId],
                };
          return {
            type: "document.connection.complete",
            payload: {
              connection: {
                id: completion.connectionId,
                ...snapshot,
                target,
                type: "mind-map",
                data: {},
              },
              ...(newNode ? { newNode } : {}),
            },
          };
        },
      );
    },
    captureConnectionDelete(connectionId: ConnectionId) {
      const document = owner.readDocument();
      const edge = document?.connections[connectionId];
      if (!document?.activeCanvasId || edge?.canvasId !== document.activeCanvasId) return null;
      const parsed = mindMapConnectionSchema.safeParse(edge);
      if (!parsed.success) return null;
      return owner.capture("connection", parsed.data, (connection, _input: void) => ({
        type: "document.connection.delete-captured",
        payload: { connection },
      }));
    },
  };
}
