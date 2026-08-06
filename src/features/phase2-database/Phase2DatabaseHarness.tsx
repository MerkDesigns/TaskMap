import { useEffect, useReducer, useRef, useState } from "react";
import {
  decodeDatabaseDocument,
  encodeDatabaseDocument,
} from "../../platform/database/databaseDocumentCodec";
import type { LoadedDocument } from "../../platform/database/databaseTypes";
import type { RecentDatabaseSettings } from "../../platform/settings/settingsTypes";
import type { AuthorizedDatabasePath } from "../../platform/settings/settingsTypes";
import { registerWindowCloseGuard } from "../../app/windowCloseCoordinator";
import { FrostedSurface } from "../../ui/materials/FrostedSurface";
import {
  Phase2DatabasePathControls,
  refreshPhase2RecentDatabases,
} from "./Phase2DatabasePathControls";
import { Phase2HarnessHeader } from "./Phase2HarnessHeader";
import { Phase2HarnessStatus } from "./Phase2HarnessStatus";
import { Phase2SessionActions } from "./Phase2SessionActions";
import { saveThenLockPhase2Document } from "./phase2LockOperation";
import {
  createPhase2TestDocument,
  readPhase2TestText,
  updatePhase2TestText,
} from "./phase2Document";
import { INITIAL_PHASE2_HARNESS_STATE, phase2HarnessReducer } from "./phase2HarnessState";
import type { Phase2DatabaseHarnessProps } from "./phase2HarnessTypes";
import "./Phase2DatabaseHarness.css";

export function Phase2DatabaseHarness({
  databaseClient,
  settingsClient,
  onDismiss,
}: Phase2DatabaseHarnessProps) {
  const [state, dispatch] = useReducer(phase2HarnessReducer, INITIAL_PHASE2_HARNESS_STATE);
  const [selectedPath, setSelectedPath] = useState<AuthorizedDatabasePath | null>(null);
  const [busy, setBusy] = useState(false);
  const [recent, setRecent] = useState<RecentDatabaseSettings | null>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const operationInFlightRef = useRef(false);

  useEffect(() => {
    void databaseClient.getSessionStatus().then((result) => {
      if (result.ok) {
        dispatch({ type: "sessionReceived", session: result.value });
      }
    });
    void refreshPhase2RecentDatabases(settingsClient, setRecent);
  }, [databaseClient, settingsClient]);

  useEffect(
    () =>
      registerWindowCloseGuard(async () => {
        if (operationInFlightRef.current) {
          throw new Error("A Phase 2 database operation is still in progress.");
        }
        if (state.session.phase === "pending_unlock") {
          const closed = await databaseClient.closeDatabase();
          if (!closed.ok) throw new Error("The pending database session could not be closed.");
          return;
        }
        if (state.session.phase !== "unlocked") return;
        if (!state.document || state.session.revision === null) return;
        const encoded = encodeDatabaseDocument(state.document);
        if (!encoded.ok) throw new Error("The document could not be validated before close.");
        const saved = await databaseClient.saveDocument({
          serializedDocument: encoded.value,
          expectedRevision: state.session.revision,
        });
        if (!saved.ok) throw new Error("The encrypted document could not be saved before close.");
        dispatch({ type: "sessionReceived", session: saved.value.session });
      }),
    [databaseClient, state.document, state.session.phase, state.session.revision],
  );

  const run = async (operation: () => Promise<void>) => {
    if (operationInFlightRef.current) return;
    operationInFlightRef.current = true;
    dispatch({ type: "clearError" });
    setBusy(true);
    try {
      await operation();
    } finally {
      operationInFlightRef.current = false;
      setBusy(false);
      if (passwordRef.current) passwordRef.current.value = "";
    }
  };

  const password = () => {
    const value = passwordRef.current?.value ?? "";
    if (passwordRef.current) passwordRef.current.value = "";
    return value;
  };

  const receiveLoaded = (loaded: LoadedDocument) => {
    const decoded = decodeDatabaseDocument(loaded.serializedDocument);
    if (!decoded.ok) {
      dispatch({ type: "operationFailed", message: decoded.error.message });
      return;
    }
    dispatch({ type: "documentReceived", session: loaded.session, document: decoded.value });
    if (loaded.warnings?.length) fail(loaded.warnings.join(" "));
  };

  const fail = (message: string) => dispatch({ type: "operationFailed", message });
  const dismissSecurely = () =>
    void run(async () => {
      if (state.session.phase === "unlocked") {
        const locked = await saveThenLockPhase2Document(
          databaseClient,
          state.document,
          state.session.revision,
        );
        if (!locked.ok) return fail(locked.error.message);
        dispatch({ type: "sessionReceived", session: locked.value });
      } else if (state.session.phase === "pending_unlock") {
        const closed = await databaseClient.closeDatabase();
        if (!closed.ok) return fail(closed.error.message);
        dispatch({ type: "sessionReceived", session: closed.value });
      }
      onDismiss();
    });

  return (
    <div className="phase2-harness-backdrop" role="dialog" aria-modal="true">
      <FrostedSurface className="phase2-harness">
        <Phase2HarnessHeader onDismiss={dismissSecurely} />

        <Phase2HarnessStatus error={state.error} session={state.session} />

        <Phase2DatabasePathControls
          busy={busy}
          selected={selectedPath}
          recent={recent}
          settingsClient={settingsClient}
          onFailure={fail}
          onPathChanged={setSelectedPath}
        />

        <div className="phase2-harness-row">
          <input
            ref={passwordRef}
            aria-label="Database password"
            type="password"
            autoComplete="off"
          />
          <button
            type="button"
            disabled={busy || !selectedPath}
            onClick={() =>
              void run(async () => {
                const databaseId = `database-${globalThis.crypto.randomUUID()}`;
                const document = createPhase2TestDocument(databaseId, "development");
                const encoded = encodeDatabaseDocument(document);
                if (!encoded.ok) return fail(encoded.error.message);
                const result = await databaseClient.createDatabase({
                  authorizationToken: selectedPath!.authorizationToken,
                  databaseId,
                  documentSchemaVersion: document.schemaVersion,
                  serializedDocument: encoded.value,
                  password: password(),
                });
                if (result.ok) receiveLoaded(result.value);
                else fail(result.error.message);
                setSelectedPath(null);
                await refreshPhase2RecentDatabases(settingsClient, setRecent);
              })
            }
          >
            Create
          </button>
          <button
            type="button"
            disabled={busy || !selectedPath}
            onClick={() =>
              void run(async () => {
                const result = await databaseClient.openDatabase({
                  authorizationToken: selectedPath!.authorizationToken,
                });
                if (result.ok) {
                  dispatch({ type: "sessionReceived", session: result.value.session });
                  if (result.value.warnings.length) fail(result.value.warnings.join(" "));
                } else fail(result.error.message);
                setSelectedPath(null);
                await refreshPhase2RecentDatabases(settingsClient, setRecent);
              })
            }
          >
            Open
          </button>
          <button
            type="button"
            disabled={busy || state.session.phase !== "locked"}
            onClick={() =>
              void run(async () => {
                const result = await databaseClient.unlockDatabase({ password: password() });
                if (result.ok) receiveLoaded(result.value);
                else fail(result.error.message);
              })
            }
          >
            Unlock
          </button>
        </div>

        {state.document && (
          <div className="phase2-harness-row">
            <input
              aria-label="Encrypted test text"
              value={readPhase2TestText(state.document)}
              onChange={(event) =>
                dispatch({
                  type: "documentEdited",
                  document: updatePhase2TestText(state.document!, event.target.value),
                })
              }
            />
          </div>
        )}

        <Phase2SessionActions
          busy={busy}
          databaseClient={databaseClient}
          settingsClient={settingsClient}
          session={state.session}
          document={state.document}
          run={run}
          onFailure={fail}
          onLoaded={receiveLoaded}
          onSessionReceived={(session) => dispatch({ type: "sessionReceived", session })}
          onDismiss={onDismiss}
        />
      </FrostedSurface>
    </div>
  );
}
