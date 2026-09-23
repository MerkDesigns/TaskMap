import type { DatabasePurpose } from "../../domain/document/documentTypes";
import type { UuidSource } from "../../domain/ids/entityIds";
import type { DatabaseClient } from "../../platform/database/databaseClient";
import type { LoadedDocument } from "../../platform/database/databaseTypes";
import type { PlatformResult } from "../../platform/platformErrors";
import type { PersistenceScheduler } from "../persistence/persistenceScheduler";
import type { DocumentAcceptance } from "../../domain/document/documentAcceptance";
import type { DomainCommandHandler } from "../../domain/commands/commandHandler";
import { createDatabaseWorkspace } from "./createDatabaseWorkspace";
import {
  createSessionDatabaseRequest,
  sessionFailure,
  sessionSuccess,
} from "./databaseSessionRequests";

type Phase = "unknown" | "closed" | "locked" | "unlocked" | "blocked";
export interface DatabaseSessionSnapshot {
  readonly phase: Phase;
  readonly busy: boolean;
  readonly recoveredFromRevision: number | null;
}
interface Options {
  readonly commandHandlers?: readonly DomainCommandHandler[];
  readonly acceptDocument?: DocumentAcceptance;
  readonly databaseClient: DatabaseClient;
  readonly expectedPurpose: DatabasePurpose;
  readonly idSource?: UuidSource;
  readonly scheduler?: PersistenceScheduler;
  // Required ownership hook for view/interaction/media caches; synchronous revocation before awaits.
  readonly purgeDocumentResources: () => void;
  readonly flushDocumentResources?: () => Promise<PlatformResult<void>>;
}

/** Unmounted application lifecycle owner. The injected client owns pending-unlock confirmation. */
export function createDatabaseSessionController(options: Options) {
  const client = options.databaseClient;
  let snapshot: DatabaseSessionSnapshot = {
    phase: "unknown",
    busy: false,
    recoveredFromRevision: null,
  };
  let epoch = 0;
  let disposed = false;
  let active: Promise<PlatformResult<void>> | null = null;
  let cancelling: Promise<PlatformResult<void>> | null = null;
  const listeners = new Set<() => void>();
  const database = createDatabaseWorkspace({
    ...options,
    canEditDocument: () => !disposed && !snapshot.busy && snapshot.phase === "unlocked",
  });
  const { store } = database;
  const publish = (patch: Partial<DatabaseSessionSnapshot>) => {
    snapshot = { ...snapshot, ...patch };
    for (const listener of listeners) {
      try {
        listener();
      } catch {
        /* Observer failures cannot interrupt session cleanup. */
      }
    }
  };
  const clearPlaintext = () => {
    let cleared = true;
    try {
      store.workspace.clear();
    } catch {
      cleared = false;
    }
    publish({ recoveredFromRevision: null });
    try {
      options.purgeDocumentResources();
      return cleared;
    } catch {
      return false;
    }
  };
  const closeBackend = async (): Promise<PlatformResult<void>> => {
    const purged = clearPlaintext();
    try {
      const result = await client.closeDatabase();
      if (purged && result.ok && result.value.phase === "closed") {
        publish({ phase: "closed" });
        return sessionSuccess;
      }
    } catch {
      /* Keep the workspace blocked when backend cleanup is uncertain. */
    }
    publish({ phase: "blocked" });
    return sessionFailure("unexpected");
  };
  const run = (
    allowed: readonly Phase[],
    work: (token: number) => Promise<PlatformResult<void>>,
  ) => {
    if (disposed || snapshot.busy || !allowed.includes(snapshot.phase))
      return Promise.resolve(sessionFailure("invalid_input"));
    const token = epoch;
    // Assign active before notifying subscribers, so reentrant cancellation sees the in-flight work.
    const task = Promise.resolve()
      .then(async () => {
        if (token !== epoch) return sessionFailure("cancelled");
        try {
          return await work(token);
        } catch {
          if (token === epoch) await closeBackend();
          return sessionFailure("unexpected");
        }
      })
      .finally(() => {
        if (active === task) active = null;
        if (token === epoch) publish({ busy: false });
      });
    active = task;
    publish({ busy: true });
    return task;
  };
  const admit = async (result: PlatformResult<LoadedDocument>, token: number) => {
    if (token !== epoch) return sessionFailure("cancelled");
    if (!result.ok) {
      // Wrong password leaves a locked candidate available for another attempt, with no plaintext.
      if (result.error.code !== "wrong_password") await closeBackend();
      return sessionFailure(result.error.code);
    }
    const admitted = database.admitLoadedDocument(result.value);
    if (token !== epoch) return sessionFailure("cancelled");
    if (!admitted.ok) {
      await closeBackend();
      return sessionFailure(admitted.error.code);
    }
    publish({ phase: "unlocked", recoveredFromRevision: admitted.value.recoveredFromRevision });
    return token === epoch ? sessionSuccess : sessionFailure("cancelled");
  };
  const flush = async (token: number, retry = false): Promise<PlatformResult<void>> => {
    if (options.flushDocumentResources) {
      const resources = await options.flushDocumentResources();
      if (token !== epoch) return sessionFailure("cancelled");
      if (!resources.ok) return resources;
    }
    // A new explicit lifecycle request is also a retry after a recoverable save failure.
    // Conflicts stay blocked by the coordinator and must never be overwritten implicitly.
    if (retry || store.getState().documentWorkspace.savePhase === "failed")
      await store.workspace.retrySave();
    else await store.workspace.flushSave();
    if (token !== epoch) return sessionFailure("cancelled");
    const state = store.getState().documentWorkspace;
    if (state.localChangeSequence !== state.persistedChangeSequence || state.saveInFlight) {
      const code = state.persistenceError?.code ?? "save_failure";
      if (code === "session_locked" || code === "session_not_open") await closeBackend();
      return sessionFailure(code);
    }
    return sessionSuccess;
  };
  const finish = (kind: "lock" | "close" | "quit") =>
    run(
      kind === "lock" ? ["unlocked"] : ["unknown", "closed", "locked", "unlocked", "blocked"],
      async (token) => {
        const saved = await flush(token);
        if (!saved.ok) return saved;
        if (kind === "close") return closeBackend();
        if (!clearPlaintext()) {
          await closeBackend();
          return sessionFailure("unexpected");
        }
        if (token !== epoch) return sessionFailure("cancelled");
        if (kind === "quit") {
          const result = await client.quitApplication();
          if (token !== epoch) return sessionFailure("cancelled");
          if (!result.ok) {
            await closeBackend();
            return sessionFailure(result.error.code);
          }
          disposed = true;
          unsubscribePersistence();
          store.disposeWorkspace();
          publish({ phase: "closed" });
          return sessionSuccess;
        }
        const result = await client.lockDatabase();
        if (token !== epoch) return sessionFailure("cancelled");
        if (!result.ok || result.value.phase !== "locked") {
          await closeBackend();
          return sessionFailure(result.ok ? "unexpected" : result.error.code);
        }
        publish({ phase: "locked" });
        return sessionSuccess;
      },
    );
  // Explicit cancellation/backend-loss path: revoke local access immediately, drain old work, close.
  let mustClose = false;
  const revoke = (allowLocked: boolean): Promise<PlatformResult<void>> => {
    if (!allowLocked) mustClose = true;
    if (cancelling) return cancelling;
    epoch++;
    const pending = active;
    const task = Promise.resolve()
      .then(async () => {
        try {
          await pending;
        } catch {
          /* A failed operation must not skip final backend cleanup. */
        }
        if (!mustClose) {
          try {
            const status = await client.getSessionStatus();
            if (
              !mustClose &&
              status.ok &&
              (status.value.phase === "locked" || status.value.phase === "closed")
            ) {
              publish({ phase: status.value.phase });
              return sessionSuccess;
            }
          } catch {
            /* Uncertain native state requires confirmed close. */
          }
        }
        return closeBackend();
      })
      .finally(() => {
        cancelling = null;
        mustClose = false;
        publish({ busy: false });
      });
    cancelling = task;
    publish({ phase: "blocked", busy: true });
    if (!clearPlaintext()) mustClose = true;
    return task;
  };
  const cancel = () => revoke(false);
  const unsubscribePersistence = store.subscribe(() => {
    // Flush handles session loss while busy; idle autosave must revoke access too.
    if (snapshot.phase !== "unlocked" || snapshot.busy) return;
    const code = store.getState().documentWorkspace.persistenceError?.code;
    if (code === "session_locked" || code === "session_not_open") void cancel();
  });
  return {
    store,
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    resume: () =>
      run(["unknown", "closed"], async (token) => {
        const status = await client.getSessionStatus();
        if (token !== epoch) return sessionFailure("cancelled");
        if (!status.ok) {
          await closeBackend();
          return sessionFailure(status.error.code);
        }
        if (status.value.phase === "pending_unlock") {
          await closeBackend();
          return sessionFailure("session_locked");
        }
        if (status.value.phase === "unlocked") {
          const read = await client.readDocument();
          if (token !== epoch) return sessionFailure("cancelled");
          if (read.ok && read.value.session.sessionId !== status.value.sessionId) {
            await closeBackend();
            return sessionFailure("session_not_open");
          }
          return admit(read, token);
        }
        publish({ phase: status.value.phase });
        return sessionSuccess;
      }),
    create: (authorizationToken: string, password: string) =>
      run(["closed"], async (token) => {
        const request = createSessionDatabaseRequest(
          authorizationToken,
          password,
          options.expectedPurpose,
          options.idSource ?? { nextUuid: () => globalThis.crypto.randomUUID() },
        );
        if (!request.ok) return request;
        return admit(await client.createDatabase(request.value), token);
      }),
    open: (authorizationToken: string) =>
      run(["closed"], async (token) => {
        const result = await client.openDatabase({ authorizationToken });
        if (token !== epoch) return sessionFailure("cancelled");
        if (!result.ok || result.value.session.phase !== "locked") {
          await closeBackend();
          return sessionFailure(result.ok ? "unexpected" : result.error.code);
        }
        publish({ phase: "locked" });
        return sessionSuccess;
      }),
    unlock: (password: string) =>
      run(["locked"], async (token) => admit(await client.unlockDatabase({ password }), token)),
    prepareWindowClose: () => run(["unlocked"], (token) => flush(token)),
    retrySave: () => run(["unlocked"], (token) => flush(token, true)),
    lock: () => finish("lock"),
    close: () => finish("close"),
    quit: () => finish("quit"),
    cancel,
    revokeFromNative: () => revoke(true),
    async dispose() {
      disposed = true;
      unsubscribePersistence();
      const result = await cancel();
      store.disposeWorkspace();
      listeners.clear();
      return result;
    },
  };
}
