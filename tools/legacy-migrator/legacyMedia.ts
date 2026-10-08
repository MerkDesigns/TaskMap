// The images bundled in a legacy export as media for the new database. The bytes are carried as
// the export holds them (base64 WebP or GIF); only images some element shows come across.
import type { MediaReference } from "../../src/domain/document/documentTypes";
import { DOCUMENT_LIMITS } from "../../src/domain/document/documentLimits";
import type { ConversionLog } from "./legacyExtensions";
import type { LegacyImage } from "./legacyExportSchema";

export interface MigratedMedia {
  readonly id: string;
  readonly mimeType: string;
  /** The image bytes, base64 encoded exactly as the export carried them. */
  readonly base64: string;
}

const MIME_TYPES: Readonly<Record<string, string>> = {
  webp: "image/webp",
  gif: "image/gif",
};

// Media ids are 24 base64url characters, like the ones the app's media storage creates.
const base64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

function decodedLength(base64: string): number | null {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64) || base64.length % 4 !== 0) return null;
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return (base64.length / 4) * 3 - padding;
}

const pixelSize = (value: number) =>
  Number.isInteger(value) && value > 0 && value <= DOCUMENT_LIMITS.elementDimension;

/** Hands out one media id per bundled image as elements ask for it. */
export function createLegacyMediaStore(
  images: readonly LegacyImage[],
  randomBytes: (length: number) => Uint8Array,
  log: ConversionLog,
) {
  const imagesByHash = new Map(images.map((image) => [image.hash, image]));
  const idsByHash = new Map<string, string>();
  const references: Record<string, MediaReference> = {};
  const media: MigratedMedia[] = [];

  return {
    references,
    media,
    /** The media id for an image hash, or null when the image cannot come across. */
    mediaFor(hash: string, where: string): string | null {
      const known = idsByHash.get(hash);
      if (known) return known;
      const image = imagesByHash.get(hash);
      if (!image) {
        log.note(`${where}: its image was missing from the export, so it is an empty image now.`);
        return null;
      }
      const mimeType = MIME_TYPES[image.format.toLowerCase()];
      const byteLength = decodedLength(image.data);
      if (!mimeType || byteLength === null || byteLength === 0) {
        log.note(`${where}: its image (${image.format}) could not be read, so it is empty now.`);
        return null;
      }
      const id = base64Url(randomBytes(18));
      const pixels = pixelSize(image.width) && pixelSize(image.height);
      references[id] = {
        id,
        mimeType,
        byteLength,
        pixelWidth: pixels ? image.width : null,
        pixelHeight: pixels ? image.height : null,
        altText: null,
      } as MediaReference;
      media.push({ id, mimeType, base64: image.data });
      idsByHash.set(hash, id);
      log.count("images stored");
      return id;
    },
  };
}
