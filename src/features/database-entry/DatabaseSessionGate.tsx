import { lazy, Suspense, useEffect, useRef, type ReactNode } from "react";
import { MaterialSurface } from "../../ui/materials/MaterialSurface";
import { WorkspaceRoot } from "../../ui/patterns/workspace/WorkspaceRoot";
import { setWorkspaceRadii, useWorkspaceRadii } from "../../ui/patterns/workspace/workspaceRadii";
import { Button } from "../../ui/primitives/Button";
import {
  DatabaseEntryProgress,
  useLateFlag,
  type DatabaseEntryStage,
} from "./DatabaseEntryProgress";
import { DatabasePasswordForm } from "./DatabasePasswordForm";
import { HalftoneBackdrop } from "./HalftoneBackdrop";
import { useDatabaseEntry } from "./useDatabaseEntry";
import { useUnlockReveal } from "./useUnlockReveal";
import { databaseEntryError } from "./databaseEntryErrors";
import type { DatabaseEntryRuntime } from "./databaseEntryTypes";
import taskmapTitle from "./taskmapTitle.png";
import "./databaseEntry.css";

/** Windows verbatim prefixes (`\\?\C:\…`, `\\?\UNC\server\…`) are not meant for people. */
export const readableDatabasePath = (path: string) =>
  path.startsWith("\\\\?\\UNC\\")
    ? `\\\\${path.slice(8)}`
    : path.startsWith("\\\\?\\")
      ? path.slice(4)
      : path;

// Work shorter than this never dims controls or shows a cancel button, so quick steps stay still.
const LATE_BUSY_MS = 450;
// Live halftone tuning for development builds only; the stable build drops the import entirely.
const HalftoneTuner = import.meta.env.DEV ? lazy(() => import("./HalftoneTuner")) : null;
const SLOW_PREPARING_MS = 1000;

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
  const lateBusy = useLateFlag(busy, LATE_BUSY_MS);
  const preparing = session.phase === "unlocked";
  const blocked = session.phase === "blocked";
  // Preparing keeps the submitted form on screen (with the progress bar) unless it needs attention
  // or runs long enough to need a way out.
  // Once ready, the panel content is frozen for the reveal: nothing may swap in mid-dissolve.
  const slowPreparing = useLateFlag(preparing && !entry.ready, SLOW_PREPARING_MS);
  const preparingDetails =
    preparing && (entry.awaitingRecovery || entry.resourceError !== null || slowPreparing);
  const formMode: "create" | "unlock" | null =
    entry.submitting ??
    (entry.creating
      ? "create"
      : session.phase === "locked" ||
          (session.phase === "closed" && busy && entry.selected !== null) ||
          (preparing && !preparingDetails)
        ? "unlock"
        : null);
  const lastFormMode = useRef<"create" | "unlock">("unlock");
  if (formMode) lastFormMode.current = formMode;
  const shownFormMode = preparing && !preparingDetails ? lastFormMode.current : formMode;
  // The path stays put while the step closes (Change database) instead of the row collapsing.
  const lastPath = useRef<string | null>(null);
  if (entry.selected) lastPath.current = readableDatabasePath(entry.selected.displayPath);
  const stage: DatabaseEntryStage = entry.ready
    ? "done"
    : preparing && !preparingDetails
      ? "preparing"
      : entry.submitting
        ? "unlocking"
        : "idle";
  // Typical opens finish in ~150 ms; the bar only appears for opens long enough to notice.
  const progressVisible = useLateFlag(stage !== "idle" && !entry.ready, 250);
  // A bar already showing when loading finishes fills to 100 % and dissolves with the panel; one
  // that had not appeared yet stays hidden instead of popping in during the reveal.
  const progressShownAtReady = useRef(false);
  if (!entry.ready) progressShownAtReady.current = progressVisible;
  const progressStage: DatabaseEntryStage = entry.ready
    ? progressShownAtReady.current
      ? "done"
      : "idle"
    : progressVisible
      ? stage
      : "idle";
  const root = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const reveal = useUnlockReveal(entry.ready, panelRef, backdropRef);
  // Matches the workspace's large panels (Settings → Visual → Interface → Side panel).
  const panelRadius = useWorkspaceRadii().sidePanel;
  const { preferences } = runtime;
  useEffect(() => {
    // Device preferences are edition-local (not in the database), so the saved panel radius
    // already applies before unlock.
    if (!preferences) return;
    let current = true;
    void preferences.load().then((result) => {
      const radii = preferences.getSnapshot()?.preferences.chromeRadii;
      if (current && result.ok && radii) setWorkspaceRadii(radii);
    });
    return () => {
      current = false;
    };
  }, [preferences]);
  useEffect(() => {
    if (!busy && !shownFormMode)
      root.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
  }, [
    busy,
    shownFormMode,
    session.phase,
    entry.autoOpenPending,
    entry.awaitingRecovery,
    entry.resourceError,
  ]);
  // Startup decides quickly whether to open the last database; show the panel once, not twice.
  const slowStartup = useLateFlag(entry.autoOpenPending, LATE_BUSY_MS);
  // The workspace mounts under the unlock screen, which stays until the reveal has played.
  if (entry.ready && reveal === "none") return <>{children}</>;
  const title = preparingDetails
    ? "Preparing your workspace"
    : blocked
      ? "Session needs attention"
      : shownFormMode === "create"
        ? "Create a password"
        : shownFormMode === "unlock"
          ? "Enter password"
          : "Recent databases";
  const showPanel = !entry.autoOpenPending || slowStartup;
  return (
    <>
      {entry.ready ? children : null}
      <WorkspaceRoot
        ref={root}
        className="taskmap-database-entry"
        data-database-entry-phase={session.phase}
        data-unlock-reveal={reveal === "none" ? undefined : reveal}
      >
        {/* The dark backdrop is its own layer so the reveal can clear it without fading the panel's
          ancestors (which would flatten its glass). */}
        <div ref={backdropRef} className="taskmap-database-entry__backdrop" aria-hidden="true">
          <HalftoneBackdrop />
        </div>
        {showPanel ? (
          <MaterialSurface
            ref={panelRef}
            as="section"
            material="acrylic-large"
            radius={panelRadius}
            className="taskmap-database-entry__panel"
            aria-labelledby="database-entry-title"
            aria-busy={busy}
          >
            <header className="taskmap-database-entry__brand">
              <img
                src={taskmapTitle}
                alt={`TaskMap${runtime.edition === "development" ? " Dev" : ""}`}
                className="taskmap-database-entry__title-image"
                draggable={false}
              />
              {runtime.edition === "development" ? (
                <span className="taskmap-database-entry__edition">Dev</span>
              ) : null}
            </header>
            {entry.autoOpenPending ? (
              <p role="status" className="taskmap-database-entry__hint">
                Opening your last database…
              </p>
            ) : (
              <>
                <h1 id="database-entry-title">{title}</h1>
                {entry.error ? (
                  <p role="alert" className="taskmap-database-entry__error">
                    {databaseEntryError(entry.error)}
                  </p>
                ) : null}
                {preparingDetails ? (
                  <>
                    {entry.awaitingRecovery ? (
                      <p role="alert">
                        TaskMap recovered this document from saved revision{" "}
                        {session.recoveredFromRevision}. More recent changes may be missing. Review
                        the workspace before making edits.
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
                      ) : entry.resourceError ? (
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
                ) : shownFormMode ? (
                  <DatabasePasswordForm
                    creating={shownFormMode === "create"}
                    busy={busy || preparing}
                    dimmed={lateBusy}
                    path={lastPath.current}
                    onSubmit={entry.submitPassword}
                    onBack={entry.back}
                    onCreateInstead={() => void entry.createInstead()}
                  />
                ) : (
                  <>
                    {session.phase === "unknown" ? (
                      <p role="status">Checking the session…</p>
                    ) : null}
                    {entry.recent.length || entry.recentPlaceholder.length ? (
                      <section
                        aria-labelledby="database-entry-title"
                        className="taskmap-database-entry__recent"
                      >
                        {entry.recent.length
                          ? entry.recent.map((path) => (
                              <Button
                                key={path.authorizationToken}
                                onClick={() => void entry.open(path)}
                                disabled={lateBusy}
                                tabIndex={0}
                              >
                                {readableDatabasePath(path.displayPath)}
                              </Button>
                            ))
                          : // Inert stand-ins for the previous list until fresh authorizations arrive.
                            entry.recentPlaceholder.map((displayPath) => (
                              <Button key={displayPath} aria-disabled tabIndex={-1}>
                                {readableDatabasePath(displayPath)}
                              </Button>
                            ))}
                      </section>
                    ) : null}
                    {entry.recentError ? (
                      <p role="status" className="taskmap-database-entry__hint">
                        Recent databases could not be loaded. You can still choose a file.
                      </p>
                    ) : null}
                    <div className="taskmap-database-entry__actions">
                      <Button
                        onClick={() => void entry.choose("create")}
                        disabled={lateBusy || session.phase !== "closed"}
                        tabIndex={0}
                      >
                        New database
                      </Button>
                      <Button
                        onClick={() => void entry.choose("open")}
                        disabled={lateBusy || session.phase !== "closed"}
                        tabIndex={0}
                      >
                        Open existing database
                      </Button>
                      {session.phase === "closed" && entry.recentError ? (
                        <Button
                          variant="ghost"
                          disabled={lateBusy}
                          onClick={entry.refreshRecent}
                          tabIndex={0}
                        >
                          Refresh
                        </Button>
                      ) : null}
                    </div>
                  </>
                )}
                {session.busy && lateBusy && !preparing && !blocked ? (
                  <Button onClick={() => void entry.cancelOpening()} tabIndex={0}>
                    Cancel opening
                  </Button>
                ) : null}
              </>
            )}
            <DatabaseEntryProgress stage={reveal === "concealing" ? "idle" : progressStage} />
          </MaterialSurface>
        ) : null}
      </WorkspaceRoot>
      {/* Outside the entry root, so the entry's initial focus never lands on a tuner control. */}
      {HalftoneTuner && reveal === "none" ? (
        <Suspense fallback={null}>
          <HalftoneTuner />
        </Suspense>
      ) : null}
    </>
  );
}
