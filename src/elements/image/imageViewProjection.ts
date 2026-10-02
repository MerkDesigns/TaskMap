import type { DocumentElement } from "../../domain/document/documentTypes";
import type { ImageElement, ElementExtensions } from "../../types";
import {
  imageElementSchema,
  type ImageDocumentElement,
  type ImageMediaMetadata,
} from "./imageModel";

// Deliberately no legacy imageId/hash, format or URL. The future renderer binding must use the
// session-bound media service, not pass this through useImageCache or legacy image commands.
export type RetainedImageView = Readonly<
  Omit<ImageElement, "imageId" | "format" | "extensions"> & {
    readonly media: ImageMediaMetadata | null;
    readonly extensions?: Readonly<Pick<ElementExtensions, "lock">>;
  }
>;

export class MissingImageMediaError extends Error {
  constructor() {
    super("Image media reference is missing or unsupported");
  }
}

export function projectImage(
  element: DocumentElement,
  layer: number,
  media: ImageMediaMetadata | undefined,
): RetainedImageView {
  const { id, geometry, data } = imageElementSchema.parse(element);
  if (data.mediaId !== null && media?.id !== data.mediaId) throw new MissingImageMediaError();
  const reference = data.mediaId === null ? null : media!;
  return Object.freeze({
    id,
    layer,
    ...geometry,
    accent: data.accent,
    background: data.background,
    ...(data.placement === null ? {} : data.placement),
    ...(reference?.pixelWidth == null ? {} : { naturalWidth: reference.pixelWidth }),
    ...(reference?.pixelHeight == null ? {} : { naturalHeight: reference.pixelHeight }),
    media: reference,
  });
}

/** The media of an image projected by `projectImage`; null for an empty image. */
export function retainedImageMedia(image: ImageElement): ImageMediaMetadata | null {
  return (image as unknown as RetainedImageView).media ?? null;
}

/**
 * The element as an image, or null for any other type. The canvas binding only admits documents
 * whose images passed their schema in the projection.
 */
export function asImageDocumentElement(
  element: DocumentElement | undefined,
): ImageDocumentElement | null {
  return element?.type === "image" ? (element as ImageDocumentElement) : null;
}
