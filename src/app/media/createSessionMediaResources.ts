import type { ApplicationMediaClient } from "../../platform/media/applicationMediaClient";
import type { ImageMediaMetadata } from "../../elements/image/imageModel";
import type { RetainedCallbackSession } from "../commands/retainedCompletionOwner";
import type { PlatformResult } from "../../platform/platformErrors";
import type { ImageDrop } from "../../platform/media/imageDropClient";
export type MediaImportSource = Blob | null | { readonly dropToken: string };

// Encoded bytes of loaded images that no element shows right now but stay ready for when one
// does again (panned back into view, canvas switched back). Without this every return reloads
// the image from the database and decodes it again, which for a large GIF takes seconds and
// leaves the WebView holding another decoded copy under a new URL.
const IDLE_MEDIA_BUDGET_BYTES = 128 * 1024 * 1024;

const mediaKey = (media: ImageMediaMetadata) => `${media.id}:${media.mimeType}:${media.byteLength}`;

export function createSessionMediaResources(
  session: RetainedCallbackSession,
  client: ApplicationMediaClient,
  urls = {
    create: (blob: Blob) => URL.createObjectURL(blob),
    revoke: (url: string) => URL.revokeObjectURL(url),
  },
) {
  type Entry = {
    count: number;
    cancelled: boolean;
    started: boolean;
    settled: boolean;
    url: string | null;
    promise: Promise<string | null>;
    readonly byteLength: number;
    lastUsed: number;
  };
  const entries = new Map<string, Entry>();
  let generation = 0;
  let disposed = false;
  let running = 0;
  const queue: (() => void)[] = [];
  let importing = false;
  const canRead = () => !disposed && session.getSnapshot().phase === "unlocked";
  const canImport = () => canRead() && !session.getSnapshot().busy;
  const pump = () => {
    while (running < 2 && queue.length) queue.shift()!();
  };
  let useClock = 0;
  /** Drops idle entries, least recently used first, until they fit the idle budget. */
  const trimIdle = () => {
    const idle = [...entries].filter(([, entry]) => entry.count === 0);
    // A load that failed is forgotten, so the next element showing it tries again.
    for (const [key, entry] of idle) if (entry.settled && entry.url === null) entries.delete(key);
    const loaded = idle
      .filter(([, entry]) => entry.url !== null)
      .sort(([, a], [, b]) => a.lastUsed - b.lastUsed);
    let bytes = loaded.reduce((sum, [, entry]) => sum + entry.byteLength, 0);
    for (const [key, entry] of loaded) {
      if (bytes <= IDLE_MEDIA_BUDGET_BYTES) break;
      bytes -= entry.byteLength;
      urls.revoke(entry.url!);
      entry.url = null;
      entries.delete(key);
    }
  };
  const clear = () => {
    generation++;
    for (const entry of entries.values()) {
      entry.cancelled = true;
      if (entry.url) urls.revoke(entry.url);
      entry.url = null;
    }
    entries.clear();
    pump();
  };
  let epoch = session.store.getState().documentWorkspace.epoch;
  const unsubscribeStore = session.store.subscribe(() => {
    const next = session.store.getState().documentWorkspace.epoch;
    if (next !== epoch) {
      epoch = next;
      clear();
    }
  });
  const unsubscribeSession = session.subscribe(() => {
    // Saving before close can fail. Keep existing leases while authority is still unlocked;
    // actual lock/revocation and workspace replacement clear them synchronously.
    if (!canRead()) clear();
  });
  const failure = (): PlatformResult<never> => ({
    ok: false,
    error: { code: "cancelled", message: "Media access is unavailable.", retryable: false },
  });
  return {
    subscribeDrops: (listener: (drop: ImageDrop) => void) =>
      client.subscribeDrops?.((drop) => {
        if (canImport()) listener(drop);
      }) ?? Promise.resolve(() => {}),
    peek: (media: ImageMediaMetadata) =>
      canRead() ? (entries.get(mediaKey(media))?.url ?? null) : null,
    // Call only for visible/imminently-visible media. Leases own URL lifetime, not element IDs/bytes.
    acquire(media: ImageMediaMetadata) {
      if (!canRead()) return { ready: Promise.resolve(null), release() {} };
      const key = mediaKey(media);
      let entry = entries.get(key);
      if (!entry) {
        const token = generation;
        const port = client.capture();
        let resolve!: (url: string | null) => void;
        entry = {
          count: 0,
          cancelled: false,
          started: false,
          settled: false,
          url: null,
          promise: new Promise((done) => {
            resolve = done;
          }),
          byteLength: media.byteLength,
          lastUsed: 0,
        };
        const captured = entry;
        entries.set(key, entry);
        queue.push(() => {
          running++;
          captured.started = true;
          void (async () => {
            const cancelled = () => captured.cancelled || token !== generation || !canRead();
            if (!port || cancelled()) return null;
            const loaded = await port.load(media.id, media, cancelled);
            if (!loaded.ok || cancelled()) return null;
            captured.url = urls.create(loaded.value);
            return captured.url;
          })()
            .catch(() => null)
            .then((url) => {
              captured.settled = true;
              resolve(url);
              // A load that finished after its last lease ended is kept as idle, within budget.
              if (captured.count === 0 && entries.get(key) === captured) trimIdle();
            })
            .finally(() => {
              running--;
              pump();
            });
        });
      }
      entry.count++;
      entry.lastUsed = ++useClock;
      pump();
      const captured = entry;
      let released = false;
      return {
        // A lease released before the load settles never sees its URL.
        ready: entry.promise.then((url) => (released ? null : url)),
        release() {
          if (released) return;
          released = true;
          if (--captured.count > 0) return;
          captured.lastUsed = ++useClock;
          if (!captured.started) {
            // Still queued: nothing shows it any more, so it never loads.
            captured.cancelled = true;
            if (entries.get(key) === captured) entries.delete(key);
            return;
          }
          trimIdle();
        },
      };
    },
    async import(source: MediaImportSource): Promise<PlatformResult<ImageMediaMetadata>> {
      if (!canImport() || importing) return failure();
      const token = generation;
      const port = client.capture();
      if (!port) return failure();
      importing = true;
      try {
        const result =
          source === null
            ? await port.choose()
            : "dropToken" in source
              ? await (port.importDrop?.(source.dropToken) ?? Promise.resolve(failure()))
              : await port.import(source, () => token !== generation || !canImport());
        return token === generation && canImport() ? result : failure();
      } catch {
        return failure();
      } finally {
        importing = false;
      }
    },
    clear,
    dispose() {
      disposed = true;
      clear();
      unsubscribeStore();
      unsubscribeSession();
    },
  };
}
