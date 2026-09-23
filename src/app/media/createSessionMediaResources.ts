import type { ApplicationMediaClient } from "../../platform/media/applicationMediaClient";
import type { ImageMediaMetadata } from "../../elements/image/imageModel";
import type { RetainedCallbackSession } from "../commands/retainedCompletionOwner";
import type { PlatformResult } from "../../platform/platformErrors";
import type { ImageDrop } from "../../platform/media/imageDropClient";
export type MediaImportSource = Blob | null | { readonly dropToken: string };

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
    url: string | null;
    promise: Promise<string | null>;
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
    // Call only for visible/imminently-visible media. Leases own URL lifetime, not element IDs/bytes.
    acquire(media: ImageMediaMetadata) {
      if (!canRead()) return { ready: Promise.resolve(null), release() {} };
      const key = `${media.id}:${media.mimeType}:${media.byteLength}`;
      let entry = entries.get(key);
      if (!entry) {
        const token = generation;
        const port = client.capture();
        let resolve!: (url: string | null) => void;
        entry = {
          count: 0,
          cancelled: false,
          url: null,
          promise: new Promise((done) => {
            resolve = done;
          }),
        };
        const captured = entry;
        entries.set(key, entry);
        queue.push(() => {
          running++;
          void (async () => {
            const cancelled = () => captured.cancelled || token !== generation || !canRead();
            if (!port || cancelled()) return null;
            const loaded = await port.load(media.id, media, cancelled);
            if (!loaded.ok || cancelled()) return null;
            captured.url = urls.create(loaded.value);
            return captured.url;
          })()
            .catch(() => null)
            .then(resolve)
            .finally(() => {
              running--;
              pump();
            });
        });
      }
      entry.count++;
      pump();
      const captured = entry;
      let released = false;
      return {
        ready: entry.promise,
        release() {
          if (released) return;
          released = true;
          if (--captured.count === 0) {
            captured.cancelled = true;
            if (captured.url) {
              urls.revoke(captured.url);
              captured.url = null;
            }
            if (entries.get(key) === captured) entries.delete(key);
          }
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
