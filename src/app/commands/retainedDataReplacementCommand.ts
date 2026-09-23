import { z } from "zod";
import { original } from "immer";
import type { TaskMapDocument } from "../../domain/document/documentTypes";
import { commandRejected, defineCommandHandler } from "../../domain/commands/commandHandler";
import { elementCommandHandlers } from "../../domain/commands/core/elementCommands";
import { entityIdSchema, jsonObjectSchema } from "../../domain/document/documentSchema";
import { containerPlacementSchema } from "../../domain/document/elementPlacement";
import { samePlacement } from "./retainedPlacementContract";
import { retainedContentSchema } from "./retainedContentContract";
import { editRetainedContentCommand } from "./retainedContentCommand";

const replaceData = elementCommandHandlers.find(
  ({ type }) => type === "document.element.replace-data",
)!;

// Immediate compatibility API, not a stale-safe editor callback. Share typed content rules and
// no-op handling; captured editor completions must supply their original fields to the group API.
export const replaceRetainedDataCommand = defineCommandHandler({
  type: replaceData.type,
  label: replaceData.label,
  history: "record",
  payloadSchema: z
    .object({ elementId: entityIdSchema("element"), data: jsonObjectSchema })
    .strict(),
  apply(document, payload) {
    const source = original(document as object) as TaskMapDocument;
    const element = source.elements[payload.elementId];
    if (!element) return [commandRejected("command.payload", "The content target does not exist.")];
    const from = { ...element.data };
    const to = { ...payload.data };
    if (element?.type === "text-card" || element?.type === "image") {
      const oldPlacement = containerPlacementSchema.safeParse(element.data.placement);
      const newPlacement = containerPlacementSchema.safeParse(payload.data.placement);
      if (
        !oldPlacement.success ||
        !newPlacement.success ||
        !samePlacement(oldPlacement.data, newPlacement.data)
      ) {
        return [
          commandRejected(
            "command.payload.data",
            "Placement requires the completed placement command.",
          ),
        ];
      }
      delete from.placement;
      delete to.placement;
    }
    if (element.type === "image") {
      if (from.mediaId !== to.mediaId) {
        return [
          commandRejected("command.payload.data", "Media replacement requires a media operation."),
        ];
      }
      delete from.mediaId;
      delete to.mediaId;
    }
    const parsed = retainedContentSchema.safeParse({
      canvasId: element.canvasId,
      updates: [{ elementId: element.id, type: element.type, from, to }],
    });
    if (!parsed.success)
      return [commandRejected("command.payload.data", "Invalid retained content fields.")];
    return editRetainedContentCommand.apply(document, parsed.data);
  },
});
