import { castDraft } from "immer";
import { z } from "zod";
import {
  documentConnectionSchema,
  entityIdSchema,
  jsonObjectSchema,
} from "../../document/documentSchema";
import type { DomainCommandHandler } from "../commandHandler";
import { commandRejected, defineCommandHandler } from "../commandHandler";

const connectionId = entityIdSchema("connection");
const connectionReference = z.object({ connectionId }).strict();

export const connectionCommandHandlers = [
  defineCommandHandler({
    type: "document.connection.insert",
    label: "Insert connection",
    history: "record",
    payloadSchema: z.object({ connection: documentConnectionSchema }).strict(),
    apply(document, payload) {
      const connection = payload.connection;
      if (document.connections[connection.id] !== undefined) {
        return [commandRejected("command.payload.connection.id", "Connection ID already exists")];
      }
      if (document.canvases[connection.canvasId] === undefined) {
        return [commandRejected("command.payload.connection.canvasId", "Canvas does not exist")];
      }
      const source = document.elements[connection.source.elementId];
      const target = document.elements[connection.target.elementId];
      if (source === undefined || target === undefined) {
        return [commandRejected("command.payload.connection", "Connection endpoint is missing")];
      }
      if (source.canvasId !== connection.canvasId || target.canvasId !== connection.canvasId) {
        return [
          commandRejected(
            "command.payload.connection",
            "Connection and endpoints must share one canvas",
          ),
        ];
      }
      document.connections[connection.id] = castDraft(connection);
    },
  }),
  defineCommandHandler({
    type: "document.connection.replace-data",
    label: "Update connection data",
    history: "record",
    payloadSchema: z.object({ connectionId, data: jsonObjectSchema }).strict(),
    apply(document, payload) {
      const connection = document.connections[payload.connectionId];
      if (connection === undefined) return missingConnection(payload.connectionId);
      Object.assign(connection, { data: payload.data });
    },
  }),
  defineCommandHandler({
    type: "document.connection.remove",
    label: "Remove connection",
    history: "record",
    payloadSchema: connectionReference,
    apply(document, payload) {
      if (document.connections[payload.connectionId] === undefined) {
        return missingConnection(payload.connectionId);
      }
      delete document.connections[payload.connectionId];
    },
  }),
] as const satisfies readonly DomainCommandHandler[];

function missingConnection(id: string) {
  return [commandRejected("command.payload.connectionId", `Connection ${id} does not exist`)];
}
