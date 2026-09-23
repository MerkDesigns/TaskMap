import { z } from "zod";
import { defineCommandHandler, commandRejected } from "../../domain/commands/commandHandler";
import { elementCommandHandlers } from "../../domain/commands/core/elementCommands";
import { mediaCommandHandlers } from "../../domain/commands/core/mediaCommands";
import { imageElementSchema, imageMediaReferenceSchema } from "../../elements/image/imageModel";
const insert = elementCommandHandlers.find(({ type }) => type === "document.element.insert")!;
const register = mediaCommandHandlers.find(({ type }) => type === "document.media.register")!;
export const importRetainedImageCommand = defineCommandHandler({
  type: "document.image.import",
  label: "Import image",
  history: "record",
  payloadSchema: z
    .object({ element: imageElementSchema, media: imageMediaReferenceSchema })
    .strict(),
  apply(document, { element, media }) {
    if (element.data.mediaId !== media.id || element.data.placement !== null)
      return [
        commandRejected(
          "command.payload",
          "Imported image must be a root referencing its imported media.",
        ),
      ];
    const issues = register.apply(document, { media });
    if (issues?.length) return issues;
    return insert.apply(document, { element });
  },
});
