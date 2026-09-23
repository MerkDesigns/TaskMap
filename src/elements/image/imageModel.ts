import { z } from "zod";
import { DOCUMENT_LIMITS } from "../../domain/document/documentLimits";
import {
  documentElementSchema,
  entityIdSchema,
  mediaReferenceSchema,
} from "../../domain/document/documentSchema";
import { containerPlacementSchema } from "../../domain/document/elementPlacement";

export const imageDataSchema = z
  .object({
    mediaId: entityIdSchema("media").nullable(),
    accent: z.string().min(1).max(DOCUMENT_LIMITS.jsonStringLength),
    background: z.boolean(),
    placement: containerPlacementSchema,
  })
  .strict();

export const imageElementSchema = documentElementSchema.extend({
  type: z.literal("image"),
  data: imageDataSchema,
});

// Current retained storage representations: raster imports become WebP; GIF/SVG remain native.
// This only validates metadata. Byte sniffing, SVG/resource safety and decode limits belong in Rust.
export const imageMediaReferenceSchema = mediaReferenceSchema
  .extend({
    mimeType: z.enum(["image/webp", "image/gif", "image/svg+xml"]),
    byteLength: z.number().int().positive().max(DOCUMENT_LIMITS.mediaByteLength),
  })
  .refine((media) => (media.pixelWidth === null) === (media.pixelHeight === null));

export type ImageDocumentElement = z.infer<typeof imageElementSchema>;
export type ImageData = z.infer<typeof imageDataSchema>;
// Media replacement requires the session-bound media operation, not a display/content edit.
export const imageContentFieldsSchema = imageDataSchema
  .omit({ placement: true, mediaId: true })
  .partial();
export type ImageMediaMetadata = Readonly<z.infer<typeof imageMediaReferenceSchema>>;
