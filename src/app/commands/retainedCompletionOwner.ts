import type { AppStore } from "../store";
import type { DatabaseSessionSnapshot } from "../database/createDatabaseSessionController";

export interface RetainedCallbackSession {
  readonly store: Pick<AppStore, "getState" | "subscribe" | "workspace">;
  getSnapshot(): DatabaseSessionSnapshot;
  subscribe(listener: () => void): () => void;
}
export type CompletionResult =
  | { readonly ok: true; readonly changed: boolean }
  | {
      readonly ok: false;
      readonly code: "expired-action" | "invalid-action" | "command-failed" | "history-failed";
    };
export interface CapturedCompletion<Input> {
  complete(input: Input): CompletionResult;
  cancel(): void;
}

// One subscription pair per application binding, never one observer per callback or pointer frame.
// Entries own only captured action data, not full document snapshots. Returned handles own keys only.
export function createRetainedCompletionOwner(session: RetainedCallbackSession) {
  type Slot =
    | "geometry"
    | "content"
    | "layers"
    | "delete"
    | "connection"
    | "extension"
    | "clipboard"
    | "container-cards"
    | "settings"
    | "canvas"
    | "creation"
    | "image-import";
  const pending = new Map<symbol, { slot: Slot; build: (input: unknown) => unknown }>();
  const invalidationListeners = new Set<() => void>();
  const clear = () => {
    pending.clear();
    invalidationListeners.forEach((listener) => listener());
  };
  let disposed = false;
  let historyRunning = false;
  const identity = () => {
    const workspace = session.store.getState().documentWorkspace;
    const lifecycle = session.getSnapshot();
    const document = workspace.document;
    return {
      epoch: workspace.epoch,
      documentId: document?.id,
      databaseId: document?.databaseId,
      canvasId: document?.activeCanvasId,
      editable: lifecycle.phase === "unlocked" && !lifecycle.busy && !!document,
    };
  };
  let previous = identity();
  const synchronize = () => {
    const next = identity();
    const invalidated =
      (!next.editable && previous.editable) ||
      next.epoch !== previous.epoch ||
      next.documentId !== previous.documentId ||
      next.databaseId !== previous.databaseId;
    const canvasChanged = next.canvasId !== previous.canvasId;
    previous = next;
    if (invalidated) clear();
    else if (canvasChanged) {
      // Internal Copy is deliberately cross-canvas, but never cross-session/workspace.
      for (const [key, entry] of pending) if (entry.slot !== "clipboard") pending.delete(key);
      invalidationListeners.forEach((listener) => listener());
    }
  };
  const unsubscribeStore = session.store.subscribe(synchronize);
  const unsubscribeSession = session.subscribe(synchronize);
  const finish = (key: symbol, input: unknown): CompletionResult => {
    synchronize();
    const build = pending.get(key)?.build;
    pending.delete(key); // Consume before dispatch/listener reentrancy, even on failure or no-op.
    if (disposed || historyRunning || !previous.editable || !build)
      return { ok: false, code: "expired-action" };
    try {
      const command = build(input);
      if (command === null) return { ok: true, changed: false };
      const result = session.store.workspace.dispatchCommand(command);
      return result.ok
        ? { ok: true, changed: result.changed }
        : { ok: false, code: "command-failed" };
    } catch {
      return { ok: false, code: "invalid-action" };
    }
  };
  function handle<Input>(key: symbol): CapturedCompletion<Input> & { isActive(): boolean } {
    return {
      isActive() {
        synchronize();
        return !disposed && !historyRunning && previous.editable && pending.has(key);
      },
      complete: (input) => finish(key, input),
      cancel: () => {
        pending.delete(key);
      },
    };
  }
  return {
    runHistory(direction: "undo" | "redo"): CompletionResult {
      synchronize();
      if (disposed || historyRunning || !previous.editable)
        return { ok: false, code: "expired-action" };
      if (direction !== "undo" && direction !== "redo")
        return { ok: false, code: "invalid-action" };
      const before = session.store.getState().documentWorkspace;
      const entries = direction === "undo" ? before.history.past : before.history.future;
      if (!entries.length) return { ok: true, changed: false };
      historyRunning = true;
      try {
        // History replaces completed document state. Cancel previews/drafts/copy captures before
        // applying it; do not commit an unfinished gesture or rebase its old snapshot afterward.
        clear();
        synchronize();
        if (disposed || !previous.editable || session.store.getState().documentWorkspace !== before)
          return { ok: false, code: "expired-action" };
        const result = session.store.workspace[direction]();
        return result.ok
          ? { ok: true, changed: result.changed }
          : { ok: false, code: "history-failed" };
      } catch {
        return { ok: false, code: "history-failed" };
      } finally {
        historyRunning = false;
      }
    },
    readDocument() {
      synchronize();
      return disposed || historyRunning || !previous.editable
        ? null
        : session.store.getState().documentWorkspace.document;
    },
    capture<Snapshot, Input>(
      slot: Slot,
      snapshot: Snapshot,
      build: (snapshot: Snapshot, input: Input) => unknown,
    ): CapturedCompletion<Input> & { isActive(): boolean } {
      synchronize();
      for (const [oldKey, entry] of pending) if (entry.slot === slot) pending.delete(oldKey);
      const key = Symbol();
      if (!disposed && !historyRunning && previous.editable)
        pending.set(key, { slot, build: (input) => build(snapshot, input as Input) });
      return handle<Input>(key);
    },
    subscribeInvalidation(listener: () => void) {
      if (disposed) return () => undefined;
      invalidationListeners.add(listener);
      return () => {
        invalidationListeners.delete(listener);
      };
    },
    clear,
    dispose() {
      if (disposed) return;
      disposed = true;
      clear();
      invalidationListeners.clear();
      unsubscribeStore();
      unsubscribeSession();
    },
  };
}
