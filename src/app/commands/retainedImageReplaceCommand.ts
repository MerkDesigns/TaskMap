import { z } from "zod";
import { commandRejected, defineCommandHandler } from "../../domain/commands/commandHandler";
import { mediaCommandHandlers } from "../../domain/commands/core/mediaCommands";
import { elementGeometrySchema } from "../../domain/document/documentSchema";
import { imageElementSchema, imageMediaReferenceSchema } from "../../elements/image/imageModel";
import { updateRetainedGeometriesCommand } from "./retainedGeometryCommands";

const register = mediaCommandHandlers.find(({ type }) => type === "document.media.register")!;
export const replaceRetainedImageCommand = defineCommandHandler({
  type: "document.image.replace",
  label: "Replace image",
  history: "record",
  payloadSchema: z
    .object({
      expected: imageElementSchema.pick({ id: true, canvasId: true, geometry: true }).extend({
        data: imageElementSchema.shape.data.pick({ mediaId: true, placement: true }),
      }),
      media: imageMediaReferenceSchema,
      geometry: elementGeometrySchema,
    })
    .strict(),
  apply(document, { expected, media, geometry }) {
    const target = document.elements[expected.id];
    const parsed = imageElementSchema.safeParse(target);
    if (
      !parsed.success ||
      parsed.data.canvasId !== expected.canvasId ||
      parsed.data.data.mediaId !== expected.data.mediaId ||
      JSON.stringify(parsed.data.data.placement) !== JSON.stringify(expected.data.placement) ||
      Object.keys(expected.geometry).some(
        (key) =>
          parsed.data.geometry[key as keyof typeof geometry] !==
          expected.geometry[key as keyof typeof geometry],
      )
    )
      return [commandRejected("command.payload", "Image changed before import completed.")];
    // Replacing existing media retains the user's box; placeholder sizing obeys geometry locks.
    if (
      expected.data.mediaId !== null &&
      Object.keys(geometry).some(
        (key) =>
          geometry[key as keyof typeof geometry] !==
          expected.geometry[key as keyof typeof geometry],
      )
    )
      return [
        commandRejected("command.payload.geometry", "Replacement must preserve image geometry."),
      ];
    const issues = updateRetainedGeometriesCommand.apply(document, {
      canvasId: expected.canvasId,
      updates: [{ elementId: expected.id, from: expected.geometry, to: geometry }],
    });
    if (issues?.length) return issues;
    const registered = register.apply(document, { media });
    if (registered?.length) return registered;
    (target as unknown as { data: { mediaId: string } }).data.mediaId = media.id;
  },
});
