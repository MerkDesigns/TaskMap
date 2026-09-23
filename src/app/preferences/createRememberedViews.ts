import type { ApplicationPreferencesClient } from "../../platform/settings/applicationPreferencesClient";
import {
  rememberedViewportSchema,
  type RememberedViews,
} from "../../platform/settings/preferenceContracts";
import type { RetainedCallbackSession } from "../commands/retainedCompletionOwner";
import type { CanvasViewport } from "../../canvas/geometry/viewportMath";
import {
  defaultPersistenceScheduler,
  type PersistenceScheduler,
} from "../persistence/persistenceScheduler";
import type { PlatformResult } from "../../platform/platformErrors";
import type { CanvasId } from "../../domain/ids/entityIds";

export function createRememberedViews(
  session: RetainedCallbackSession,
  client: ApplicationPreferencesClient,
  scheduler: PersistenceScheduler = defaultPersistenceScheduler,
) {
  let value: RememberedViews = { version: 1, canvases: {} };
  let generation = 0;
  let change = 0;
  let saved = 0;
  let timer: unknown = null;
  let port: ReturnType<ApplicationPreferencesClient["captureViews"]> = null;
  let loading: Promise<PlatformResult<void>> | null = null;
  let saving: Promise<PlatformResult<void>> | null = null;
  let disposed = false;
  const ok = (): PlatformResult<void> => ({ ok: true, value: undefined });
  const failed = (): PlatformResult<never> => ({
    ok: false,
    error: {
      code: "cancelled",
      message: "View-state operation was cancelled or unavailable.",
      retryable: false,
    },
  });
  const cancelTimer = () => {
    if (timer !== null) scheduler.cancel(timer);
    timer = null;
  };
  const clear = () => {
    generation++;
    cancelTimer();
    value = { version: 1, canvases: {} };
    change = saved = 0;
    port = null;
    loading = saving = null;
  };
  let epoch = session.store.getState().documentWorkspace.epoch;
  const unsubscribe = session.store.subscribe(() => {
    const next = session.store.getState().documentWorkspace.epoch;
    if (next !== epoch) {
      epoch = next;
      clear();
    }
  });
  const flush = (): Promise<PlatformResult<void>> => {
    cancelTimer();
    if (saving) return saving;
    if (saved === change) return Promise.resolve(ok());
    const token = generation;
    const capturedPort = port;
    if (!capturedPort || disposed) return Promise.resolve(failed());
    const task = (async () => {
      while (token === generation && saved !== change) {
        const target = change;
        const result = await capturedPort.save(value);
        if (token !== generation) return failed();
        if (!result.ok) return result;
        saved = target;
      }
      return ok();
    })()
      .catch(() => failed())
      .finally(() => {
        if (token === generation) saving = null;
      });
    saving = task;
    return task;
  };
  return {
    load() {
      if (loading) return loading;
      if (port) return Promise.resolve(ok());
      if (disposed || session.getSnapshot().phase !== "unlocked" || session.getSnapshot().busy)
        return Promise.resolve(failed());
      const capturedPort = client.captureViews();
      if (!capturedPort) return Promise.resolve(failed());
      const token = generation;
      loading = capturedPort
        .load()
        .then((result) => {
          if (token !== generation) return failed();
          if (!result.ok) return result;
          const canvases = session.store.getState().documentWorkspace.document?.canvases ?? {};
          value = {
            version: 1,
            canvases: Object.fromEntries(
              Object.entries(result.value.canvases).filter(([id]) => !!canvases[id as CanvasId]),
            ),
          };
          port = capturedPort;
          return ok();
        })
        .catch(() => failed())
        .finally(() => {
          if (token === generation) loading = null;
        });
      return loading;
    },
    isReady: () => port !== null && !disposed,
    get(canvasId: string) {
      const viewport = value.canvases[canvasId as CanvasId];
      return viewport
        ? { zoom: viewport.zoom, pan: { ...viewport.pan }, screen: { ...viewport.screen } }
        : null;
    },
    // Connect only to the existing controller's onViewportSettled, never its frame subscription.
    remember(viewport: CanvasViewport, canvasKey: string) {
      const canvasId = canvasKey as CanvasId;
      const document = session.store.getState().documentWorkspace.document;
      const parsed = rememberedViewportSchema.safeParse(viewport);
      if (
        !port ||
        disposed ||
        session.getSnapshot().busy ||
        session.getSnapshot().phase !== "unlocked" ||
        !document?.canvases[canvasId] ||
        !parsed.success
      )
        return false;
      const old = value.canvases[canvasId];
      const next = parsed.data;
      if (
        old &&
        old.zoom === next.zoom &&
        old.pan.x === next.pan.x &&
        old.pan.y === next.pan.y &&
        old.screen.width === next.screen.width &&
        old.screen.height === next.screen.height
      )
        return true;
      value = {
        version: 1,
        canvases: {
          ...Object.fromEntries(
            Object.entries(value.canvases).filter(([id]) => !!document.canvases[id as CanvasId]),
          ),
          [canvasId]: next,
        },
      };
      change++;
      cancelTimer();
      timer = scheduler.schedule(() => {
        timer = null;
        void flush();
      }, 350);
      return true;
    },
    flush,
    clear,
    dispose() {
      disposed = true;
      clear();
      unsubscribe();
    },
  };
}
