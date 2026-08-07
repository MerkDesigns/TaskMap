import { vi } from "vitest";
import {
  createCommandTestDocument,
  COMMAND_TEST_IDS,
} from "../../domain/commands/commandTestSupport";
import { asEntityId } from "../../domain/ids/entityIds";
import type { DatabaseSessionStatus, SavedDocument } from "../../platform/database/databaseTypes";
import type { PlatformResult } from "../../platform/platformErrors";
import type { DocumentPersistenceDependencies } from "../persistence/documentPersistenceCoordinator";
import { createAppStore } from "../store";
import type { PersistenceScheduler } from "../persistence/persistenceScheduler";

export class FakePersistenceScheduler implements PersistenceScheduler {
  private nextHandle = 1;
  private readonly callbacks = new Map<number, () => void>();
  private readonly registeredCallbacks = new Map<number, () => void>();
  readonly delays: number[] = [];
  readonly handles: number[] = [];
  readonly cancel = vi.fn((handle: unknown) => {
    this.callbacks.delete(handle as number);
  });

  schedule(callback: () => void, delayMs: number): number {
    const handle = this.nextHandle++;
    this.callbacks.set(handle, callback);
    this.registeredCallbacks.set(handle, callback);
    this.delays.push(delayMs);
    this.handles.push(handle);
    return handle;
  }

  get size() {
    return this.callbacks.size;
  }

  runNext() {
    const entry = this.callbacks.entries().next().value as [number, () => void] | undefined;
    if (!entry) throw new Error("No scheduled persistence callback exists");
    this.callbacks.delete(entry[0]);
    entry[1]();
  }

  runRegistered(handle: number) {
    const callback = this.registeredCallbacks.get(handle);
    if (!callback) throw new Error(`No persistence callback was registered for handle ${handle}`);
    callback();
  }
}

export function createDeferred<Value>() {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

export async function settlePersistenceContinuations() {
  for (let continuation = 0; continuation < 8; continuation += 1) {
    await Promise.resolve();
  }
}

export function savedDocument(revision: number): PlatformResult<SavedDocument> {
  return {
    ok: true,
    value: { revision, session: { ...unlockedSession, revision } },
  };
}

export const unlockedSession: DatabaseSessionStatus = {
  phase: "unlocked",
  sessionId: "database-session-00000000-0000-4000-8000-000000000020",
  databasePath: "test.tmapdb",
  databaseId: COMMAND_TEST_IDS.database,
  documentSchemaVersion: 1,
  revision: 4,
  lastActivityAt: "2026-08-06T00:00:00Z",
};

export function createWorkspaceTestStore(persistence?: DocumentPersistenceDependencies) {
  let transaction = 20;
  let now = 100;
  return createAppStore({
    transactionDependencies: {
      nextTransactionId: () =>
        asEntityId(
          "transaction",
          `transaction-00000000-0000-4000-8000-${String(transaction++).padStart(12, "0")}`,
        ),
      now: () => now++,
    },
    persistence,
  });
}

export function loadTestWorkspace(
  store: ReturnType<typeof createWorkspaceTestStore>,
  revision = 4,
) {
  const result = store.workspace.load(createCommandTestDocument(), revision);
  if (!result.ok) throw new Error(result.message);
  return result;
}

export function renameCommand(name: string) {
  return {
    type: "document.canvas.rename",
    payload: { canvasId: COMMAND_TEST_IDS.canvasA, name },
  };
}
