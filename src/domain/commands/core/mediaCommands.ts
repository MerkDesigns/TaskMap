import { z } from "zod";
import { entityIdSchema, mediaReferenceSchema } from "../../document/documentSchema";
import type { DomainCommandHandler } from "../commandHandler";
import { commandRejected, defineCommandHandler } from "../commandHandler";

const mediaId = entityIdSchema("media");
const mediaReference = z.object({ mediaId }).strict();
const metadataUpdate = mediaReferenceSchema
  .omit({ id: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one metadata field is required");

export const mediaCommandHandlers = [
  defineCommandHandler({
    type: "document.media.register",
    label: "Register media reference",
    history: "record",
    payloadSchema: z.object({ media: mediaReferenceSchema }).strict(),
    apply(document, payload) {
      if (document.mediaReferences[payload.media.id] !== undefined) {
        return [commandRejected("command.payload.media.id", "Media ID already exists")];
      }
      document.mediaReferences[payload.media.id] = payload.media;
    },
  }),
  defineCommandHandler({
    type: "document.media.update-metadata",
    label: "Update media metadata",
    history: "record",
    payloadSchema: z.object({ mediaId, metadata: metadataUpdate }).strict(),
    apply(document, payload) {
      const media = document.mediaReferences[payload.mediaId];
      if (media === undefined) return missingMedia(payload.mediaId);
      if (payload.metadata.mimeType !== undefined) media.mimeType = payload.metadata.mimeType;
      if (payload.metadata.byteLength !== undefined) media.byteLength = payload.metadata.byteLength;
      if (payload.metadata.pixelWidth !== undefined) media.pixelWidth = payload.metadata.pixelWidth;
      if (payload.metadata.pixelHeight !== undefined)
        media.pixelHeight = payload.metadata.pixelHeight;
      if (payload.metadata.altText !== undefined) media.altText = payload.metadata.altText;
    },
  }),
  defineCommandHandler({
    type: "document.media.remove",
    label: "Remove media reference",
    history: "record",
    payloadSchema: mediaReference,
    apply(document, payload) {
      if (document.mediaReferences[payload.mediaId] === undefined) {
        return missingMedia(payload.mediaId);
      }
      delete document.mediaReferences[payload.mediaId];
    },
  }),
] as const satisfies readonly DomainCommandHandler[];

function missingMedia(id: string) {
  return [commandRejected("command.payload.mediaId", `Media ${id} does not exist`)];
}
