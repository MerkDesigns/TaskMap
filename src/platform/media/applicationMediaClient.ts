import { z } from "zod";
import { invokePlatformRaw } from "../tauriInvoke";
import type { PlatformResult } from "../platformErrors";
import type { SessionAuthority } from "../settings/preferenceContracts";
import { imageMediaReferenceSchema } from "../../elements/image/imageModel";
import { subscribeImageDrops, type ImageDrop } from "./imageDropClient";

const CHUNK = 256 * 1024;
const storedSchema = imageMediaReferenceSchema;
const descriptionSchema = z
  .object({
    kind: z.literal("description"),
    mimeType: z.enum(["image/webp", "image/gif", "image/svg+xml"]),
    byteLength: z
      .number()
      .int()
      .positive()
      .max(64 * 1024 * 1024),
  })
  .strict();
const failure = (): PlatformResult<never> => ({
  ok: false,
  error: {
    code: "invalid_input",
    message: "Media operation is invalid or no longer authorized.",
    retryable: false,
  },
});
export function createApplicationMediaClient(authority: () => SessionAuthority | null) {
  return {
    subscribeDrops: subscribeImageDrops,
    capture() {
      const captured = authority();
      if (!captured) return null;
      const current = () => {
        const now = authority();
        return now?.databaseId === captured.databaseId && now?.sessionId === captured.sessionId;
      };
      const request = async (operation: unknown): Promise<PlatformResult<unknown>> => {
        if (!current()) return failure();
        const result = await invokePlatformRaw("app_media_transfer", { ...captured, operation });
        return current() ? result : failure();
      };
      return {
        async importDrop(token: string) {
          if (!current() || !token || token.length > 128) return failure();
          const result = await invokePlatformRaw<unknown>("app_import_dropped_image", {
            ...captured,
            token,
          });
          if (!current()) return failure();
          if (!result.ok) return result;
          const reply = z
            .object({
              kind: z.literal("stored"),
              id: z.string(),
              mimeType: z.string(),
              byteLength: z.number(),
              pixelWidth: z.number().positive(),
              pixelHeight: z.number().positive(),
            })
            .strict()
            .safeParse(result.value);
          if (!reply.success) return failure();
          const { kind: _kind, ...metadata } = reply.data;
          const parsed = storedSchema.safeParse({ ...metadata, altText: null });
          return parsed.success ? { ok: true as const, value: parsed.data } : failure();
        },
        async choose() {
          if (!current()) return failure();
          const result = await invokePlatformRaw<unknown>("app_choose_image", captured);
          if (!current()) return failure();
          if (!result.ok) return result;
          if (result.value === null)
            return {
              ok: false as const,
              error: {
                code: "cancelled" as const,
                message: "Image selection cancelled.",
                retryable: false,
              },
            };
          const reply = z
            .object({
              kind: z.literal("stored"),
              id: z.string(),
              mimeType: z.string(),
              byteLength: z.number(),
              pixelWidth: z.number().positive(),
              pixelHeight: z.number().positive(),
            })
            .strict()
            .safeParse(result.value);
          if (!reply.success) return failure();
          const { kind: _kind, ...metadata } = reply.data;
          const parsed = storedSchema.safeParse({ ...metadata, altText: null });
          return parsed.success ? { ok: true as const, value: parsed.data } : failure();
        },
        async import(source: Blob, cancelled: () => boolean = () => false) {
          if (!source.size || source.size > 50 * 1024 * 1024 || cancelled()) return failure();
          const start = await request({ action: "start", byteLength: source.size });
          if (!start.ok) return start;
          const started = z
            .object({ kind: z.literal("started"), token: z.string().min(1).max(128) })
            .strict()
            .safeParse(start.value);
          if (!started.success) return failure();
          const { token } = started.data;
          let finished = false;
          try {
            for (let offset = 0; offset < source.size; offset += CHUNK) {
              if (cancelled()) return failure();
              const bytes = new Uint8Array(
                await source.slice(offset, offset + CHUNK).arrayBuffer(),
              );
              let binary = "";
              for (const byte of bytes) binary += String.fromCharCode(byte);
              if (cancelled()) return failure();
              const result = await request({ action: "append", token, offset, data: btoa(binary) });
              if (!result.ok) return result;
            }
            if (cancelled()) return failure();
            const result = await request({ action: "finish", token });
            if (!result.ok) return result;
            const reply = z
              .object({
                kind: z.literal("stored"),
                id: z.string(),
                mimeType: z.string(),
                byteLength: z.number(),
                pixelWidth: z.number().positive(),
                pixelHeight: z.number().positive(),
              })
              .strict()
              .safeParse(result.value);
            if (!reply.success) return failure();
            const { kind: _kind, ...metadata } = reply.data;
            const parsed = storedSchema.safeParse({ ...metadata, altText: null });
            if (!parsed.success) return failure();
            finished = true;
            return { ok: true as const, value: parsed.data };
          } catch {
            return failure();
          } finally {
            if (!finished) await request({ action: "cancel", token });
          }
        },
        async load(
          id: string,
          expected: { mimeType: string; byteLength: number },
          cancelled: () => boolean = () => false,
        ): Promise<PlatformResult<Blob>> {
          if (!/^[A-Za-z0-9_-]{24}$/.test(id) || cancelled()) return failure();
          const described = await request({ action: "describe", mediaId: id });
          if (!described.ok) return described;
          const parsed = descriptionSchema.safeParse(described.value);
          if (
            !parsed.success ||
            parsed.data.byteLength !== expected.byteLength ||
            parsed.data.mimeType !== expected.mimeType
          )
            return failure();
          const parts: BlobPart[] = [];
          try {
            for (let offset = 0; offset < expected.byteLength; offset += CHUNK) {
              if (cancelled()) return failure();
              const result = await request({ action: "read", mediaId: id, offset });
              if (!result.ok) return result;
              const reply = z
                .object({
                  kind: z.literal("chunk"),
                  data: z.string().max(Math.ceil(CHUNK / 3) * 4),
                })
                .strict()
                .safeParse(result.value);
              if (!reply.success) return failure();
              const binary = atob(reply.data.data);
              if (binary.length !== Math.min(CHUNK, expected.byteLength - offset)) return failure();
              parts.push(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
            }
            return current() && !cancelled()
              ? { ok: true, value: new Blob(parts, { type: expected.mimeType }) }
              : failure();
          } catch {
            return failure();
          }
        },
      };
    },
  };
}
type NativeMediaClient = ReturnType<typeof createApplicationMediaClient>;
type NativeMediaPort = NonNullable<ReturnType<NativeMediaClient["capture"]>>;
export type ApplicationMediaClient = {
  capture():
    (Omit<NativeMediaPort, "importDrop"> & Partial<Pick<NativeMediaPort, "importDrop">>) | null;
  subscribeDrops?: (listener: (drop: ImageDrop) => void) => Promise<() => void>;
};
