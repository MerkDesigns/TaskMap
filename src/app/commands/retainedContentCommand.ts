import { original } from "immer";
import { commandRejected, defineCommandHandler } from "../../domain/commands/commandHandler";
import type { TaskMapDocument } from "../../domain/document/documentTypes";
import { retainedContentSchema } from "./retainedContentContract";

export const editRetainedContentCommand = defineCommandHandler({
  type: "document.elements.edit-content",
  label: "Edit element content",
  history: "record",
  payloadSchema: retainedContentSchema,
  apply(document, payload) {
    const source = original(document as object) as TaskMapDocument;
    const seen = new Set<string>();
    for (const { elementId, type, from, to } of payload.updates) {
      const element = source.elements[elementId];
      const keys = Object.keys(to);
      const expected: Readonly<Record<string, unknown>> = from;
      if (
        !element ||
        element.canvasId !== payload.canvasId ||
        element.type !== type ||
        seen.has(elementId) ||
        keys.length !== Object.keys(from).length ||
        keys.some(
          (key) =>
            !Object.prototype.hasOwnProperty.call(from, key) || element.data[key] !== expected[key],
        )
      ) {
        return [
          commandRejected(
            "command.payload.updates",
            "Content is invalid or changed before completion.",
          ),
        ];
      }
      seen.add(elementId);
    }
    // Retained locks protect movement/resize/deletion, not text, color or display controls.
    // Field-scoped expected values preserve unrelated changes made while an editor is open.
    for (const { elementId, to } of payload.updates) {
      const data = source.elements[elementId].data;
      if (Object.entries(to).some(([key, value]) => data[key] !== value)) {
        // The envelope and typed fields are validated above. A shallow draft view avoids TS's
        // recursive Draft<JsonObject> expansion while retaining field-local Immer patches.
        const target = document.elements[elementId] as unknown as { data: object };
        Object.assign(target.data, to);
      }
    }
  },
});
