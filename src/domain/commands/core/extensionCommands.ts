import { castDraft } from "immer";
import { z } from "zod";
import {
  entityIdSchema,
  extensionInstallationSchema,
  jsonObjectSchema,
} from "../../document/documentSchema";
import type { ExtensionTarget } from "../../document/documentTypes";
import type { DomainCommandHandler } from "../commandHandler";
import { commandRejected, defineCommandHandler } from "../commandHandler";

const installationId = entityIdSchema("extension-instance");
const installationReference = z.object({ installationId }).strict();

export const extensionCommandHandlers = [
  defineCommandHandler({
    type: "document.extension.install",
    label: "Install extension",
    history: "record",
    payloadSchema: z.object({ installation: extensionInstallationSchema }).strict(),
    apply(document, payload) {
      const installation = payload.installation;
      if (document.extensionInstallations[installation.id] !== undefined) {
        return [
          commandRejected("command.payload.installation.id", "Extension installation ID exists"),
        ];
      }
      const target = installation.target;
      const targetExists =
        target.kind === "document"
          ? target.documentId === document.id
          : target.kind === "canvas"
            ? document.canvases[target.canvasId] !== undefined
            : document.elements[target.elementId] !== undefined;
      if (!targetExists) {
        return [commandRejected("command.payload.installation.target", "Target does not exist")];
      }
      const duplicate = Object.values(document.extensionInstallations).some(
        (current) =>
          current.extensionId === installation.extensionId &&
          targetKey(current.target) === targetKey(installation.target),
      );
      if (duplicate) {
        return [
          commandRejected(
            "command.payload.installation",
            "Extension is already installed on this target",
          ),
        ];
      }
      document.extensionInstallations[installation.id] = castDraft(installation);
    },
  }),
  defineCommandHandler({
    type: "document.extension.set-enabled",
    label: "Change extension state",
    history: "record",
    payloadSchema: z.object({ installationId, enabled: z.boolean() }).strict(),
    apply(document, payload) {
      const installation = document.extensionInstallations[payload.installationId];
      if (installation === undefined) return missingInstallation(payload.installationId);
      installation.enabled = payload.enabled;
    },
  }),
  defineCommandHandler({
    type: "document.extension.replace-configuration",
    label: "Update extension configuration",
    history: "record",
    payloadSchema: z.object({ installationId, configuration: jsonObjectSchema }).strict(),
    apply(document, payload) {
      const installation = document.extensionInstallations[payload.installationId];
      if (installation === undefined) return missingInstallation(payload.installationId);
      Object.assign(installation, { configuration: payload.configuration });
    },
  }),
  defineCommandHandler({
    type: "document.extension.remove",
    label: "Remove extension",
    history: "record",
    payloadSchema: installationReference,
    apply(document, payload) {
      if (document.extensionInstallations[payload.installationId] === undefined) {
        return missingInstallation(payload.installationId);
      }
      delete document.extensionInstallations[payload.installationId];
    },
  }),
] as const satisfies readonly DomainCommandHandler[];

function targetKey(target: ExtensionTarget): string {
  if (target.kind === "document") return `document:${target.documentId}`;
  if (target.kind === "canvas") return `canvas:${target.canvasId}`;
  return `element:${target.elementId}`;
}

function missingInstallation(id: string) {
  return [
    commandRejected(
      "command.payload.installationId",
      `Extension installation ${id} does not exist`,
    ),
  ];
}
