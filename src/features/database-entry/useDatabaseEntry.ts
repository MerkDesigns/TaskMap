import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { AuthorizedDatabasePath } from "../../platform/settings/settingsTypes";
import type { PlatformErrorCode, PlatformResult } from "../../platform/platformErrors";
import type { DatabaseEntryRuntime } from "./databaseEntryTypes";

// View flow only. The injected application controller remains the sole session/workspace owner.
export function useDatabaseEntry(runtime: DatabaseEntryRuntime) {
  const { controller, settingsClient } = runtime;
  const session = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  const readEpoch = () => controller.store.getState().documentWorkspace.epoch;
  const epoch = useSyncExternalStore(controller.store.subscribe, readEpoch, readEpoch);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<PlatformErrorCode | null>(null);
  const [recent, setRecent] = useState<readonly AuthorizedDatabasePath[]>([]);
  const [recentError, setRecentError] = useState(false);
  const [recentAttempt, setRecentAttempt] = useState(0);
  const [selected, setSelected] = useState<AuthorizedDatabasePath | null>(null);
  const [creating, setCreating] = useState(false);
  const [readyEpoch, setReadyEpoch] = useState<number | null>(null);
  const [acknowledgedRecoveryEpoch, setAcknowledgedRecoveryEpoch] = useState<number | null>(null);
  const [resourceAttempt, setResourceAttempt] = useState(0);
  const [resourceError, setResourceError] = useState<PlatformErrorCode | null>(null);
  const occupied = useRef(false);
  const generation = useRef(0);
  const bootstrap = useRef<Promise<PlatformResult<void>> | null>(null);

  useEffect(() => {
    const token = ++generation.current;
    bootstrap.current ??=
      controller.getSnapshot().phase === "unknown"
        ? controller.resume()
        : Promise.resolve({ ok: true, value: undefined });
    void bootstrap.current.then((result) => {
      if (token === generation.current && !result.ok) setError(result.error.code);
    });
    return () => {
      generation.current = token + 1;
    };
  }, [controller]);

  useEffect(() => {
    if (session.phase !== "closed") return;
    let current = true;
    setRecent([]);
    setRecentError(false);
    void settingsClient
      .listRecentDatabases()
      .then((result) => {
        if (!current) return;
        if (result.ok && result.value.edition === runtime.edition)
          setRecent(result.value.recentDatabases);
        else setRecentError(true);
      })
      .catch(() => {
        if (current) setRecentError(true);
      });
    return () => {
      current = false;
    };
  }, [runtime.edition, session.phase, settingsClient, recentAttempt]);

  useEffect(() => {
    if (session.phase !== "unlocked") {
      setReadyEpoch(null);
      setResourceError(null);
      return;
    }
    if (session.busy || readyEpoch === epoch) return;
    let current = true;
    setResourceError(null);
    void runtime
      .initializeResources()
      .then((result) => {
        if (!current) return;
        if (result.ok && readEpoch() === epoch && controller.getSnapshot().phase === "unlocked")
          setReadyEpoch(epoch);
        else setResourceError(result.ok ? "cancelled" : result.error.code);
      })
      .catch(() => {
        if (current) setResourceError("unexpected");
      });
    return () => {
      current = false;
    };
    // readyEpoch is intentionally not a retrigger: retry is explicit and lifecycle changes revoke work.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runtime, epoch, session.phase, session.busy, resourceAttempt]);

  const run = useCallback(
    async (work: (current: () => boolean) => Promise<PlatformResult<unknown>>) => {
      if (occupied.current || controller.getSnapshot().busy) return;
      occupied.current = true;
      setWorking(true);
      setError(null);
      const token = generation.current;
      const current = () => generation.current === token;
      try {
        const result = await work(current);
        if (current() && !result.ok && result.error.code !== "cancelled")
          setError(result.error.code);
      } catch {
        if (current()) setError("unexpected");
      } finally {
        occupied.current = false;
        if (current()) setWorking(false);
      }
    },
    [controller],
  );

  const open = (path: AuthorizedDatabasePath) =>
    run(async () => {
      setSelected(path);
      setRecent([]); // One-use authorizations must not be reused after an attempted open.
      return controller.open(path.authorizationToken);
    });

  return {
    session,
    working,
    error,
    recent,
    recentError,
    selected,
    creating,
    resourceError,
    ready:
      session.phase === "unlocked" &&
      readyEpoch === epoch &&
      (session.recoveredFromRevision === null || acknowledgedRecoveryEpoch === epoch),
    awaitingRecovery:
      session.phase === "unlocked" &&
      readyEpoch === epoch &&
      session.recoveredFromRevision !== null &&
      acknowledgedRecoveryEpoch !== epoch,
    acknowledgeRecovery() {
      setAcknowledgedRecoveryEpoch(epoch);
    },
    open,
    choose(mode: "create" | "open") {
      return run(async (current) => {
        const candidateEpoch = readEpoch();
        const result = await settingsClient.chooseDatabasePath(mode);
        if (
          !current() ||
          readEpoch() !== candidateEpoch ||
          controller.getSnapshot().phase !== "closed" ||
          !result.ok ||
          !result.value
        )
          return result;
        setSelected(result.value);
        if (mode === "create") {
          setCreating(true);
          return { ok: true, value: undefined };
        }
        setRecent([]);
        return controller.open(result.value.authorizationToken);
      });
    },
    submitPassword(password: string) {
      return run(async () => {
        if (creating && selected) {
          const token = selected.authorizationToken;
          setSelected(null);
          setCreating(false);
          return controller.create(token, password);
        }
        return controller.unlock(password);
      });
    },
    back() {
      setSelected(null);
      setCreating(false);
      setError(null);
      if (session.phase === "locked") void run(() => controller.close());
    },
    refreshRecent() {
      setRecentAttempt((value) => value + 1);
    },
    retryResources() {
      setResourceAttempt((value) => value + 1);
    },
    cancelOpening: () => controller.cancel(),
  };
}
