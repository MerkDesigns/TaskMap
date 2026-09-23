import type { ApplicationMediaClient } from "../../../platform/media/applicationMediaClient";
import type { PlatformResult } from "../../../platform/platformErrors";
import { asEntityId } from "../../../domain/ids/entityIds";
import type { ImageMediaMetadata } from "../../../elements/image/imageModel";

/** Disposable transport for visible media checks. No native picker, paths, storage or production codec. */
export function createPreviewMediaClient(sessionKey: () => string | null) {
  const blobs = new Map<string, Blob>();
  const failure = (): PlatformResult<never> => ({
    ok: false,
    error: { code: "cancelled", message: "Preview media unavailable.", retryable: false },
  });
  const client: ApplicationMediaClient = {
    capture() {
      const key = sessionKey();
      if (!key) return null;
      const current = () => key === sessionKey();
      const store = (
        blob: Blob,
        width: number,
        height: number,
        mimeType: ImageMediaMetadata["mimeType"],
      ): PlatformResult<ImageMediaMetadata> => {
        if (!current()) return failure();
        const id = asEntityId("media", crypto.randomUUID().replace(/-/g, "").slice(0, 24));
        blobs.set(id, blob);
        return {
          ok: true,
          value: {
            id,
            byteLength: blob.size,
            mimeType,
            pixelWidth: width,
            pixelHeight: height,
            altText: null,
          },
        };
      };
      return {
        async choose() {
          // The simulated picker returns an obvious built-in fixture, never a user file.
          const svg =
            '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="320" height="200" fill="#215c75"/><circle cx="160" cy="100" r="64" fill="#ffad66"/><path d="M80 160L160 40L240 160Z" fill="#d7edf3"/></svg>';
          return store(new Blob([svg], { type: "image/svg+xml" }), 320, 200, "image/svg+xml");
        },
        async import(source, cancelled = () => false) {
          if (
            !current() ||
            cancelled() ||
            source.size > 4 * 1024 * 1024 ||
            !["image/gif", "image/webp"].includes(source.type)
          )
            return failure();
          try {
            const decoded = await createImageBitmap(source);
            const { width, height } = decoded;
            decoded.close();
            if (!current() || cancelled()) return failure();
            return store(source, width, height, source.type as "image/gif" | "image/webp");
          } catch {
            return failure();
          }
        },
        async load(id, expected, cancelled = () => false) {
          const blob = blobs.get(id);
          return current() &&
            !cancelled() &&
            blob &&
            blob.type === expected.mimeType &&
            blob.size === expected.byteLength
            ? { ok: true as const, value: blob }
            : failure();
        },
      };
    },
  };
  return { client, clear: () => blobs.clear() };
}
