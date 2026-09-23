import type { TaskMapDocument } from "../../domain/document/documentTypes";
import type { RetainedCallbackSession } from "../commands/retainedCompletionOwner";
import type { createRememberedViews } from "../preferences/createRememberedViews";
import {
  createRetainedCanvasInteractionController,
  type RetainedCanvasInteractionController,
} from "../interactions/createRetainedCanvasInteractionController";
import { createRetainedCanvasProjection } from "./createRetainedCanvasProjection";
import type { RetainedCanvasView } from "./retainedCanvasProjectionTypes";

type InteractionOptions = Parameters<typeof createRetainedCanvasInteractionController>[0];
type Options = Omit<InteractionOptions, "canvasKey" | "onViewportSettled"> & {
  readonly session: RetainedCallbackSession;
  readonly views: Pick<ReturnType<typeof createRememberedViews>, "isReady" | "get" | "remember">;
  // The UI must synchronously discard drafts, clipboard/JSON buffers and rendered media on revoke.
  readonly onRevoke: () => void;
};
export type RetainedCanvasBindingSnapshot =
  | { readonly phase: "revoked" }
  | {
      readonly phase: "ready";
      readonly editable: boolean;
      readonly canvases: readonly RetainedCanvasView[];
      readonly activeCanvas: RetainedCanvasView | null;
      readonly settings: TaskMapDocument["documentSettings"];
    };
const revoked: RetainedCanvasBindingSnapshot = Object.freeze({ phase: "revoked" });

/** One view lifetime over the admitted workspace; no writable document or camera mirror. */
export function createRetainedCanvasBinding(options: Options) {
  const { session, views } = options;
  const initial = session.store.getState().documentWorkspace;
  if (
    !initial.document ||
    !views.isReady() ||
    session.getSnapshot().phase !== "unlocked" ||
    session.getSnapshot().busy
  )
    throw new Error("The canvas requires an admitted session and initialized resources.");

  const projection = createRetainedCanvasProjection();
  const epoch = initial.epoch;
  const listeners = new Set<() => void>();
  let document: TaskMapDocument | null = null;
  let snapshot: RetainedCanvasBindingSnapshot = revoked;
  let interaction: RetainedCanvasInteractionController | null = null;
  let disposed = false;
  let resourcesRevoked = false;
  let revoking = false;
  let unsubscribeStore = () => {};
  let unsubscribeSession = () => {};
  const notify = () => {
    for (const listener of listeners) {
      try {
        listener();
      } catch {
        // One view observer cannot prevent revocation of other owners.
      }
    }
  };
  const revokeResources = () => {
    if (resourcesRevoked || revoking) return;
    revoking = true;
    try {
      options.onRevoke();
      resourcesRevoked = true;
    } finally {
      revoking = false;
    }
  };
  const clear = () => {
    if (disposed) return revokeResources();
    disposed = true;
    unsubscribeStore();
    unsubscribeSession();
    document = null;
    snapshot = revoked;
    projection.clear();
    try {
      interaction?.dispose();
    } finally {
      try {
        revokeResources();
      } finally {
        notify();
        listeners.clear();
      }
    }
  };
  const viewportFor = (canvasKey: string) => {
    const saved = views.get(canvasKey);
    return {
      pan: saved?.pan ?? options.viewport.pan,
      zoom: saved?.zoom ?? options.viewport.zoom,
      screen: interaction?.getSnapshot().viewport.screen ?? options.viewport.screen,
    };
  };
  const synchronizeOnce = () => {
    if (disposed) return;
    const workspace = session.store.getState().documentWorkspace;
    const lifecycle = session.getSnapshot();
    const next = workspace.document;
    if (workspace.epoch !== epoch || !next || lifecycle.phase !== "unlocked" || !views.isReady()) {
      clear();
      return;
    }
    if (next === document && snapshot.phase === "ready") {
      if (snapshot.editable !== !lifecycle.busy) {
        snapshot = Object.freeze({ ...snapshot, editable: !lifecycle.busy });
        notify();
      }
      return;
    }
    const result = projection.project(next);
    if (!result.ok) {
      clear();
      return;
    }
    const canvasKey = next.activeCanvasId ?? "";
    if (interaction && interaction.getSnapshot().canvasKey !== canvasKey)
      interaction.replaceCanvas(canvasKey, viewportFor(canvasKey));
    if (disposed || session.store.getState().documentWorkspace.document !== next) return;
    document = next;
    snapshot = Object.freeze({
      phase: "ready",
      editable: !session.getSnapshot().busy,
      canvases: result.canvases,
      activeCanvas: result.canvases.find(({ id }) => id === next.activeCanvasId) ?? null,
      settings: next.documentSettings,
    });
    notify();
  };
  let synchronizing = false;
  let pending = false;
  const synchronize = () => {
    pending = true;
    if (synchronizing) return;
    synchronizing = true;
    try {
      do {
        pending = false;
        synchronizeOnce();
      } while (pending && !disposed);
    } finally {
      synchronizing = false;
    }
  };
  synchronize();
  if (disposed) throw new Error("The admitted document cannot be presented.");
  interaction = createRetainedCanvasInteractionController({
    actions: options.actions,
    canvasKey: initial.document.activeCanvasId ?? "",
    viewport: viewportFor(initial.document.activeCanvasId ?? ""),
    panFrameScheduler: options.panFrameScheduler,
    onCompletion: options.onCompletion,
    onViewportSettled: (viewport, canvasKey) => {
      if (!disposed) views.remember(viewport, canvasKey);
    },
  });
  unsubscribeStore = session.store.subscribe(synchronize);
  unsubscribeSession = session.subscribe(synchronize);
  return {
    interaction,
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      if (!disposed) listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    // Revoked handles never reactivate, even when the same database/element IDs reopen.
    clear,
    dispose: clear,
  };
}
