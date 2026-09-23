import type { WindowCloseClient } from "../platform/window/tauriWindowCloseClient";
import type { PlatformResult } from "../platform/platformErrors";

/** One close path for the title-bar button and native Alt+F4/close requests. */
export function createWindowCloseController(options: {
  client: WindowCloseClient;
  prepareClose(): Promise<PlatformResult<void>>;
  onError(): void;
}) {
  let disposed = false;
  let finished = false;
  let pending: Promise<void> | null = null;
  let unlisten: (() => void) | undefined;
  const requestClose = () => {
    if (disposed || finished) return Promise.resolve();
    if (pending) return pending;
    pending = Promise.resolve()
      .then(async () => {
        if (disposed) return;
        try {
          const result = await options.prepareClose();
          if (disposed) return;
          if (!result.ok) {
            options.onError();
            return;
          }
          await options.client.destroy();
          finished = true;
        } catch {
          if (!disposed) options.onError();
        }
      })
      .finally(() => {
        pending = null;
      });
    return pending;
  };
  const ready = options.client
    .onCloseRequested(() => {
      void requestClose();
    })
    .then((stop) => {
      if (disposed) stop();
      else unlisten = stop;
    })
    .catch(() => {
      if (!disposed) options.onError();
    });
  return {
    ready,
    requestClose,
    dispose() {
      disposed = true;
      unlisten?.();
      unlisten = undefined;
    },
  };
}
