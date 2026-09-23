import { z } from "zod";
import { commandRejected, defineCommandHandler } from "../../domain/commands/commandHandler";
import { connectionCommandHandlers } from "../../domain/commands/core/connectionCommands";
import { elementCommandHandlers } from "../../domain/commands/core/elementCommands";
import {
  mindMapConnectionSchema,
  type MindMapDocumentConnection,
} from "../../elements/mind-map/mindMapConnectionModel";
import { mindMapNodeElementSchema } from "../../elements/mind-map/mindMapModel";

const insertElement = elementCommandHandlers.find(
  (handler) => handler.type === "document.element.insert",
)!;
const insertConnection = connectionCommandHandlers.find(
  (handler) => handler.type === "document.connection.insert",
)!;
const removeConnection = connectionCommandHandlers.find(
  (handler) => handler.type === "document.connection.remove",
)!;

export const oppositeMindMapPort = {
  left: "right",
  right: "left",
  top: "bottom",
  bottom: "top",
} as const;
const reject = () => [
  commandRejected(
    "command.payload",
    "Connection endpoints or captured edge are invalid or changed.",
  ),
];

// Invoke existing handlers inside one transaction. Never dispatch node insertion and edge insertion
// separately: a rejected edge must not leave a node, history entry or save behind.
export const completeRetainedConnectionCommand = defineCommandHandler({
  type: "document.connection.complete",
  label: "Connect elements",
  history: "record",
  payloadSchema: z
    .object({ connection: mindMapConnectionSchema, newNode: mindMapNodeElementSchema.optional() })
    .strict(),
  apply(document, { connection, newNode }) {
    if (newNode) {
      if (
        document.elements[connection.source.elementId]?.type !== "mind-map-node" ||
        newNode.id !== connection.target.elementId ||
        newNode.canvasId !== connection.canvasId ||
        connection.target.portId !== oppositeMindMapPort[connection.source.portId]
      )
        return reject();
      const issues = insertElement.apply(document, { element: newNode });
      if (issues?.length) return issues;
    }
    // Product candidate acceptance remains the shared endpoint-capability/pair authority.
    return insertConnection.apply(document, { connection });
  },
});

export const deleteCapturedConnectionCommand = defineCommandHandler({
  type: "document.connection.delete-captured",
  label: "Delete connection",
  history: "record",
  payloadSchema: z.object({ connection: mindMapConnectionSchema }).strict(),
  apply(document, { connection }) {
    const current = document.connections[connection.id];
    if (
      !current ||
      current.type !== connection.type ||
      current.canvasId !== connection.canvasId ||
      !sameEndpoint(current.source, connection.source) ||
      !sameEndpoint(current.target, connection.target)
    )
      return reject();
    return removeConnection.apply(document, { connectionId: connection.id });
  },
});
function sameEndpoint(
  a: { elementId: string; portId: string | null },
  b: MindMapDocumentConnection["source"],
) {
  return a.elementId === b.elementId && a.portId === b.portId;
}
