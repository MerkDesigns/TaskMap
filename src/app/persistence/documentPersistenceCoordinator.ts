import type { TaskMapDocument } from "../../domain/document/documentTypes";
import type { DatabaseClient } from "../../platform/database/databaseClient";
import { encodeDatabaseDocument } from "../../platform/database/databaseDocumentCodec";
import type { PlatformResult } from "../../platform/platformErrors";
import { sanitizePersistenceError, unexpectedPersistenceError } from "./persistenceErrors";
import {
  DEFAULT_DOCUMENT_AUTOSAVE_DELAY_MS,
  defaultPersistenceScheduler,
  type PersistenceScheduler,
} from "./persistenceScheduler";
import { workspaceActions } from "../workspace/workspaceSlice";
import type { DocumentWorkspaceState } from "../workspace/workspaceTypes";

interface PersistenceStore {
  getState(): { readonly documentWorkspace: DocumentWorkspaceState };
  dispatch(action: ReturnType<(typeof workspaceActions)[keyof typeof workspaceActions]>): unknown;
}

export interface DocumentPersistenceDependencies {
  readonly databaseClient: Pick<DatabaseClient, "saveDocument">;
  readonly scheduler?: PersistenceScheduler;
  readonly delayMs?: number;
  readonly encodeDocument?: (document: TaskMapDocument) => PlatformResult<string>;
}

export interface DocumentPersistenceCoordinator {
  documentChanged(): void;
  workspaceReplaced(): void;
  cancelScheduled(): void;
  flush(): Promise<void>;
  retry(): Promise<void>;
  dispose(): void;
}

interface ActiveSave {
  readonly epoch: number;
  readonly sequence: number;
  readonly promise: Promise<SaveCompletion>;
}

type SaveCompletion =
  | { readonly status: "succeeded"; readonly sequence: number }
  | { readonly status: "failed" }
  | { readonly status: "stale" };

export function createDocumentPersistenceCoordinator(
  store: PersistenceStore,
  dependencies: DocumentPersistenceDependencies,
): DocumentPersistenceCoordinator {
  const scheduler = dependencies.scheduler ?? defaultPersistenceScheduler;
  const delayMs = dependencies.delayMs ?? DEFAULT_DOCUMENT_AUTOSAVE_DELAY_MS;
  const encode = dependencies.encodeDocument ?? encodeDatabaseDocument;
  let scheduled: { readonly epoch: number; readonly handle: unknown } | null = null;
  let activeSave: ActiveSave | null = null;
  let disposed = false;

  const cancelScheduled = () => {
    if (scheduled === null) return;
    const { epoch, handle } = scheduled;
    scheduled = null;
    scheduler.cancel(handle);
    if (!disposed) store.dispatch(workspaceActions.persistenceScheduleCancelled({ epoch }));
  };

  const cancelScheduledForEpoch = (epoch: number) => {
    if (scheduled?.epoch === epoch) cancelScheduled();
  };

  const scheduleLatest = () => {
    if (disposed) return;
    const state = store.getState().documentWorkspace;
    if (!isSaveAllowed(state) || state.saveInFlight) return;
    const epoch = state.epoch;
    cancelScheduledForEpoch(epoch);
    const handle = scheduler.schedule(() => {
      if (scheduled?.handle !== handle) return;
      scheduled = null;
      void beginSave(epoch);
    }, delayMs);
    scheduled = { epoch, handle };
    store.dispatch(workspaceActions.persistenceScheduled({ epoch }));
  };

  const beginSave = (epoch: number): ActiveSave | null => {
    if (!isCurrentEpoch(epoch)) return null;
    const state = store.getState().documentWorkspace;
    if (activeSave?.epoch === epoch) return activeSave;
    if (!isSaveAllowed(state)) return null;
    cancelScheduledForEpoch(epoch);

    const capture = {
      epoch,
      sequence: state.localChangeSequence,
      expectedRevision: state.backendRevision,
      document: state.document,
    };
    store.dispatch(workspaceActions.persistenceStarted({ epoch: capture.epoch }));
    const promise = Promise.resolve().then(() => persistCapture(capture));
    activeSave = { epoch, sequence: capture.sequence, promise };
    return activeSave;
  };

  const persistCapture = async (capture: {
    epoch: number;
    sequence: number;
    expectedRevision: number;
    document: TaskMapDocument;
  }): Promise<SaveCompletion> => {
    let encoded: PlatformResult<string>;
    try {
      encoded = encode(capture.document);
    } catch {
      encoded = { ok: false, error: unexpectedPersistenceError() };
    }
    if (!encoded.ok) {
      return finishFailure(capture, sanitizePersistenceError(encoded.error));
    }

    try {
      const result = await dependencies.databaseClient.saveDocument({
        serializedDocument: encoded.value,
        expectedRevision: capture.expectedRevision,
      });
      if (!result.ok) {
        return finishFailure(capture, sanitizePersistenceError(result.error));
      }
      if (!isValidSavedRevision(result.value.revision, capture.expectedRevision)) {
        return finishFailure(capture, unexpectedPersistenceError());
      }
      return finishSuccess(capture, result.value.revision);
    } catch {
      return finishFailure(capture, unexpectedPersistenceError());
    }
  };

  const finishSuccess = (
    capture: { epoch: number; sequence: number },
    backendRevision: number,
  ): SaveCompletion => {
    if (!isCurrentEpoch(capture.epoch)) return { status: "stale" };
    activeSave = null;
    store.dispatch(
      workspaceActions.persistenceSucceeded({
        epoch: capture.epoch,
        sequence: capture.sequence,
        backendRevision,
      }),
    );
    scheduleLatest();
    return { status: "succeeded", sequence: capture.sequence };
  };

  const finishFailure = (
    capture: { epoch: number; sequence: number; expectedRevision: number },
    error: ReturnType<typeof sanitizePersistenceError>,
  ): SaveCompletion => {
    if (!isCurrentEpoch(capture.epoch)) return { status: "stale" };
    activeSave = null;
    const conflict =
      error.code === "revision_conflict"
        ? { expectedRevision: capture.expectedRevision, message: error.message }
        : null;
    store.dispatch(workspaceActions.persistenceFailed({ epoch: capture.epoch, error, conflict }));
    return { status: "failed" };
  };

  const isCurrentEpoch = (epoch: number) =>
    !disposed && store.getState().documentWorkspace.epoch === epoch;

  const madeProgress = (epoch: number, previousSequence: number, result: SaveCompletion) => {
    if (!isCurrentEpoch(epoch) || result.status !== "succeeded") return false;
    const persisted = store.getState().documentWorkspace.persistedChangeSequence;
    return persisted > previousSequence && persisted >= result.sequence;
  };

  const drainAfterSuccess = async (epoch: number): Promise<void> => {
    while (isCurrentEpoch(epoch)) {
      const state = store.getState().documentWorkspace;
      if (state.savePhase === "failed" || !isSaveAllowed(state)) return;
      cancelScheduledForEpoch(epoch);
      const save = beginSave(epoch);
      if (save === null) return;
      const previousSequence = state.persistedChangeSequence;
      const result = await save.promise;
      if (!isCurrentEpoch(epoch) || !madeProgress(epoch, previousSequence, result)) return;
    }
  };

  const workspaceReplaced = () => {
    cancelScheduled();
    activeSave = null;
  };

  const flush = async () => {
    if (disposed) return;
    const epoch = store.getState().documentWorkspace.epoch;
    cancelScheduledForEpoch(epoch);
    const pending = activeSave?.epoch === epoch ? activeSave : null;
    if (pending !== null) {
      const previousSequence = store.getState().documentWorkspace.persistedChangeSequence;
      const result = await pending.promise;
      if (!isCurrentEpoch(epoch) || !madeProgress(epoch, previousSequence, result)) return;
    }
    if (!isCurrentEpoch(epoch)) return;
    return drainAfterSuccess(epoch);
  };

  const retry = async () => {
    if (disposed) return;
    const epoch = store.getState().documentWorkspace.epoch;
    const pending = activeSave?.epoch === epoch ? activeSave : null;
    if (pending !== null) {
      const previousSequence = store.getState().documentWorkspace.persistedChangeSequence;
      const result = await pending.promise;
      if (!isCurrentEpoch(epoch)) return;
      if (madeProgress(epoch, previousSequence, result)) {
        return drainAfterSuccess(epoch);
      }
      if (result.status !== "failed") return;
    }
    if (!isCurrentEpoch(epoch)) return;
    const state = store.getState().documentWorkspace;
    if (state.savePhase !== "failed" || !isSaveAllowed(state)) return;
    cancelScheduledForEpoch(epoch);
    const save = beginSave(epoch);
    if (save === null) return;
    const result = await save.promise;
    if (!isCurrentEpoch(epoch) || !madeProgress(epoch, state.persistedChangeSequence, result))
      return;
    return drainAfterSuccess(epoch);
  };

  return {
    documentChanged: scheduleLatest,
    workspaceReplaced,
    cancelScheduled,
    flush,
    retry,
    dispose() {
      if (disposed) return;
      cancelScheduled();
      disposed = true;
      activeSave = null;
    },
  };
}

function isSaveAllowed(state: DocumentWorkspaceState): state is DocumentWorkspaceState & {
  document: TaskMapDocument;
  backendRevision: number;
} {
  return (
    state.document !== null &&
    state.backendRevision !== null &&
    state.autosavePermitted &&
    state.revisionConflict === null &&
    !state.saveInFlight &&
    state.localChangeSequence > state.persistedChangeSequence
  );
}

function isValidSavedRevision(revision: number, expectedRevision: number): boolean {
  return Number.isSafeInteger(revision) && revision > expectedRevision;
}
