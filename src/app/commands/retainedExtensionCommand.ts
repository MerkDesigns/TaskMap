import { castDraft, original } from "immer";
import { z } from "zod";
import { commandRejected, defineCommandHandler } from "../../domain/commands/commandHandler";
import { DOCUMENT_LIMITS } from "../../domain/document/documentLimits";
import {
  entityIdSchema,
  extensionInstallationSchema,
  moduleIdSchema,
} from "../../domain/document/documentSchema";
import type { TaskMapDocument } from "../../domain/document/documentTypes";
import { areJsonValuesDeepEqual } from "../../domain/document/jsonDeepEqual";
import { findArchitectureExtensionDefinition } from "../../extensions/architectureRegistry";

export const retainedExtensionChangeSchema = z
  .object({
    elementId: entityIdSchema("element"),
    elementType: moduleIdSchema,
    extensionId: moduleIdSchema,
    from: extensionInstallationSchema.nullable(),
    to: extensionInstallationSchema.nullable(),
  })
  .strict();

const reject = () => [
  commandRejected(
    "command.payload",
    "Extension targets or captured installations are invalid or changed.",
  ),
];

// One completed group transaction. Product admission remains the shared retained-definition,
// configuration, compatibility and conflict authority. Locks do not prevent their own controls.
export const editRetainedExtensionsCommand = defineCommandHandler({
  type: "document.extensions.edit",
  label: "Edit extensions",
  history: "record",
  payloadSchema: z
    .object({
      canvasId: entityIdSchema("canvas"),
      updates: z.array(retainedExtensionChangeSchema).max(DOCUMENT_LIMITS.extensionInstanceCount),
    })
    .strict(),
  apply(document, { canvasId, updates }) {
    const source = original(document as object) as TaskMapDocument;
    if (source.activeCanvasId !== canvasId) return reject();
    const installations = new Map(
      Object.values(source.extensionInstallations)
        .filter((entry) => entry.target.kind === "element")
        .map((entry) => [
          entry.target.kind === "element" ? `${entry.target.elementId}:${entry.extensionId}` : "",
          entry,
        ]),
    );
    const targets = new Set<string>();
    const newIds = new Set<string>();
    for (const update of updates) {
      const { elementId, elementType, extensionId, from, to } = update;
      const element = source.elements[elementId];
      const definition = findArchitectureExtensionDefinition(extensionId);
      const key = `${elementId}:${extensionId}`;
      if (
        targets.has(key) ||
        !definition?.compatibleElementTypes.includes(element?.type) ||
        element?.canvasId !== canvasId ||
        element.type !== elementType ||
        !areJsonValuesDeepEqual(installations.get(key) ?? null, from)
      )
        return reject();
      targets.add(key);
      for (const entry of [from, to]) {
        if (
          entry &&
          (entry.extensionId !== extensionId ||
            entry.target.kind !== "element" ||
            entry.target.elementId !== elementId)
        )
          return reject();
      }
      if (from && to && from.id !== to.id) return reject();
      if (!from && to) {
        if (source.extensionInstallations[to.id] || newIds.has(to.id)) return reject();
        newIds.add(to.id);
      }
    }
    for (const { from, to } of updates) {
      if (areJsonValuesDeepEqual(from, to)) continue;
      if (!to && from) delete document.extensionInstallations[from.id];
      else if (to && !from) document.extensionInstallations[to.id] = castDraft(to);
      else if (to && from) {
        const entry = document.extensionInstallations[from.id];
        entry.enabled = to.enabled;
        if (!areJsonValuesDeepEqual(from.configuration, to.configuration))
          Object.assign(entry, { configuration: to.configuration });
      }
    }
  },
});
