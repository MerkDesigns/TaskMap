import { useEffect, useRef, type ReactNode } from "react";
import { MaterialSurface } from "../../ui/materials/MaterialSurface";
import { WorkspaceRoot } from "../../ui/patterns/workspace/WorkspaceRoot";
import { Button } from "../../ui/primitives/Button";
import { DatabasePasswordForm } from "./DatabasePasswordForm";
import { useDatabaseEntry } from "./useDatabaseEntry";
import { databaseEntryError } from "./databaseEntryErrors";
import type { DatabaseEntryRuntime } from "./databaseEntryTypes";
import "./databaseEntry.css";

/** No runtime construction or disposal here: the application boot owner supplies one session. */
export function DatabaseSessionGate({
  runtime,
  children,
}: {
  readonly runtime: DatabaseEntryRuntime;
  readonly children: ReactNode;
}) {
  const entry = useDatabaseEntry(runtime);
  const { session } = entry;
  const busy = entry.working || session.busy;
  const passwordStep = entry.creating || session.phase === "locked";
  const preparing = session.phase === "unlocked";
  const blocked = session.phase === "blocked";
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!busy && !passwordStep)
      root.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
  }, [busy, passwordStep, session.phase, entry.awaitingRecovery, entry.resourceError]);
  if (entry.ready) return <>{children}</>;
  return (
    <WorkspaceRoot
      ref={root}
      className="taskmap-database-entry"
      data-database-entry-phase={session.phase}
      data-native-tab-navigation="true"
    >
      <MaterialSurface
        as="section"
        material="acrylic-large"
        radius={12}
        className="taskmap-database-entry__panel"
        aria-labelledby="database-entry-title"
        aria-busy={busy}
      >
        <header>
          <p className="taskmap-database-entry__eyebrow">
            TaskMap{runtime.edition === "development" ? " Dev" : ""}
          </p>
          <h1 id="database-entry-title">
            {preparing
              ? "Preparing your workspace"
              : blocked
                ? "Session needs attention"
                : entry.creating
                  ? "Protect your new database"
                  : passwordStep
                    ? "Unlock your database"
                    : "Your workspace, on your device"}
          </h1>
          <p className="taskmap-database-entry__hint">
            {passwordStep
              ? "Your password unlocks the document, not the media files."
              : "Create a database or open a current .tmapdb file. Older TaskMap files stay untouched."}
          </p>
        </header>
        <p className="taskmap-database-entry__privacy">
          Canvas content is encrypted. Images and GIFs are not encrypted and can be extracted from
          the database file.
        </p>
        {entry.selected && passwordStep ? (
          <p className="taskmap-database-entry__path">{entry.selected.displayPath}</p>
        ) : null}
        {entry.error ? (
          <p role="alert" className="taskmap-database-entry__error">
            {databaseEntryError(entry.error)}
          </p>
        ) : null}
        {preparing ? (
          <>
            {entry.awaitingRecovery ? (
              <p role="alert">
                TaskMap recovered this document from saved revision {session.recoveredFromRevision}.
                More recent changes may be missing. Review the workspace before making edits.
              </p>
            ) : entry.resourceError ? (
              <p role="alert" className="taskmap-database-entry__error">
                {databaseEntryError(entry.resourceError)}
              </p>
            ) : (
              <p role="status">Loading preferences and remembered views…</p>
            )}
            <div className="taskmap-database-entry__actions">
              {entry.awaitingRecovery ? (
                <Button
                  variant="primary"
                  onClick={entry.acknowledgeRecovery}
                  disabled={busy}
                  tabIndex={0}
                >
                  Review recovered workspace
                </Button>
              ) : null}
              {entry.resourceError ? (
                <Button onClick={entry.retryResources} disabled={busy} tabIndex={0}>
                  Retry loading
                </Button>
              ) : null}
              <Button onClick={() => void entry.cancelOpening()} tabIndex={0}>
                Cancel opening
              </Button>
            </div>
          </>
        ) : blocked ? (
          <Button onClick={() => void entry.cancelOpening()} disabled={busy} tabIndex={0}>
            Retry session cleanup
          </Button>
        ) : passwordStep ? (
          <DatabasePasswordForm
            creating={entry.creating}
            busy={busy}
            onSubmit={entry.submitPassword}
            onBack={entry.back}
          />
        ) : (
          <>
            <div className="taskmap-database-entry__actions">
              <Button
                variant="primary"
                onClick={() => void entry.choose("create")}
                disabled={busy || session.phase !== "closed"}
                tabIndex={0}
              >
                New database
              </Button>
              <Button
                onClick={() => void entry.choose("open")}
                disabled={busy || session.phase !== "closed"}
                tabIndex={0}
              >
                Open database
              </Button>
            </div>
            {session.phase === "unknown" ? <p role="status">Checking the session…</p> : null}
            {entry.recent.length ? (
              <section aria-label="Recent databases" className="taskmap-database-entry__recent">
                <h2>Recent databases</h2>
                {entry.recent.map((path) => (
                  <Button
                    key={path.authorizationToken}
                    onClick={() => void entry.open(path)}
                    disabled={busy}
                    tabIndex={0}
                  >
                    {path.displayPath}
                  </Button>
                ))}
              </section>
            ) : null}
            {entry.recentError ? (
              <p role="status" className="taskmap-database-entry__hint">
                Recent databases could not be loaded. You can still choose a file.
              </p>
            ) : null}
            {session.phase === "closed" && !entry.recent.length ? (
              <Button variant="ghost" disabled={busy} onClick={entry.refreshRecent} tabIndex={0}>
                Refresh recent databases
              </Button>
            ) : null}
          </>
        )}
        {session.busy && !preparing && !blocked ? (
          <Button onClick={() => void entry.cancelOpening()} tabIndex={0}>
            Cancel opening
          </Button>
        ) : null}
      </MaterialSurface>
    </WorkspaceRoot>
  );
}
