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
  const [recentLoading, setRecentLoading] = useState(false);
  // Display paths of the last list shown, held while fresh authorizations load so returning to the
  // list does not collapse and regrow. Never used to open anything.
  const [recentHeld, setRecentHeld] = useState<readonly string[]>([]);
  const [selected, setSelected] = useState<AuthorizedDatabasePath | null>(null);
  const [creating, setCreating] = useState(false);
  // The password step being submitted; keeps that step on screen while it runs.
  const [submitting, setSubmitting] = useState<"create" | "unlock" | null>(null);
  const [readyEpoch, setReadyEpoch] = useState<number | null>(null);
  const [acknowledgedRecoveryEpoch, setAcknowledgedRecoveryEpoch] = useState<number | null>(null);
  const [resourceAttempt, setResourceAttempt] = useState(0);
  const [resourceError, setResourceError] = useState<PlatformErrorCode | null>(null);
  // The most recent database opens straight to its unlock step once per app run; "Change
  // database" and later closes show the recent list instead.
  const [autoOpenSettled, setAutoOpenSettled] = useState(false);
  // Undefined until the first recent list arrives; null when there is nothing to open.
  const [autoOpenCandidate, setAutoOpenCandidate] = useState<AuthorizedDatabasePath | null>();
  const autoOpened = useRef(false);
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
    if (session.phase === "unknown" || session.phase === "closed") return;
    autoOpened.current = true;
    setAutoOpenSettled(true);
  }, [session.phase]);

  useEffect(() => {
    if (session.phase !== "closed") return;
    let current = true;
    setRecent([]);
    setRecentError(false);
    setRecentLoading(true);
    void settingsClient
      .listRecentDatabases()
      .then((result) => {
        if (!current) return;
        const usable = result.ok && result.value.edition === runtime.edition;
        setRecentLoading(false);
        if (usable) {
          setRecent(result.value.recentDatabases);
          setRecentHeld(result.value.recentDatabases.map((path) => path.displayPath));
        } else setRecentError(true);
        if (!autoOpened.current)
          setAutoOpenCandidate((usable && result.value.recentDatabases[0]) || null);
      })
      .catch(() => {
        if (!current) return;
        setRecentLoading(false);
        setRecentError(true);
        if (!autoOpened.current) setAutoOpenCandidate(null);
      });
    return () => {
      current = false;
    };
  }, [runtime.edition, session.phase, settingsClient, recentAttempt]);

  useEffect(() => {
    if (autoOpenCandidate === undefined || autoOpened.current) return;
    if (autoOpenCandidate && (session.phase !== "closed" || session.busy || working)) return;
    autoOpened.current = true;
    setAutoOpenSettled(true);
    if (autoOpenCandidate) void open(autoOpenCandidate);
    // open is recreated per render; this runs once the first recent list meets an idle session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenCandidate, session.phase, session.busy, working]);

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
      const result = await controller.open(path.authorizationToken);
      // A failed open stays on the list; fetch fresh authorizations instead of leaving it empty.
      if (!result.ok) setRecentAttempt((value) => value + 1);
      return result;
    });

  const pick = async (mode: "create" | "open", current: () => boolean) => {
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
      return { ok: true as const, value: undefined };
    }
    setRecent([]);
    return controller.open(result.value.authorizationToken);
  };

  return {
    session,
    working,
    error,
    recent,
    /** Last shown display paths while a fresh list loads; inert placeholders only. */
    recentPlaceholder: recentLoading ? recentHeld : [],
    recentError,
    selected,
    creating,
    submitting,
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
    /** Startup auto-open of the most recent database has not been decided yet. */
    autoOpenPending: !autoOpenSettled,
    choose(mode: "create" | "open") {
      return run((current) => pick(mode, current));
    },
    /** From the unlock step: release the locked database, then pick where to create a new one. */
    createInstead() {
      setSelected(null);
      setError(null);
      return run(async (current) => {
        const closed = await controller.close();
        if (!closed.ok || !current()) return closed;
        return pick("create", current);
      });
    },
    submitPassword(password: string) {
      return run(async () => {
        setSubmitting(creating ? "create" : "unlock");
        try {
          if (creating && selected) {
            const token = selected.authorizationToken;
            setSelected(null);
            setCreating(false);
            return await controller.create(token, password);
          }
          return await controller.unlock(password);
        } finally {
          setSubmitting(null);
        }
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
