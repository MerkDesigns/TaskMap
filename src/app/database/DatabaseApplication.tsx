import { useEffect, useRef, useState } from "react";
import { createTauriDatabaseSessionController } from "./createTauriDatabaseSessionController";
import { DatabaseSessionGate } from "../../features/database-entry/DatabaseSessionGate";
import { DatabaseWindowChrome } from "../../features/database-entry/DatabaseWindowChrome";
import { RetainedCanvasApplication } from "../../legacy/RetainedCanvasApplication";
import type { DatabaseApplicationRuntime } from "../../features/database-entry/databaseEntryTypes";
import type { PlatformResult } from "../../platform/platformErrors";
import { ApplicationErrorBoundary } from "../errors/ApplicationErrorBoundary";
import { defaultApplicationErrorReporter } from "../errors/applicationErrorReporter";
import { createWindowCloseController } from "../createWindowCloseController";
import { tauriWindowCloseClient } from "../../platform/window/tauriWindowCloseClient";

// One runtime per renderer lifetime. React StrictMode must not create two native session owners.
let boot: ReturnType<typeof createTauriDatabaseSessionController> | undefined;
const start = () =>
  (boot ??= createTauriDatabaseSessionController({ purgeDocumentResources() {} }));

async function prepareClose(): Promise<PlatformResult<void>> {
  // Closing after a pre-boot render failure must not create a database/session owner.
  if (!boot) return { ok: true, value: undefined };
  const result = await boot.catch(() => null);
  if (!result) return { ok: true, value: undefined };
  if (!result.ok) return { ok: true, value: undefined };
  const { controller } = result.value;
  const session = controller.getSnapshot();
  if (session.busy || session.phase === "unknown" || session.phase === "blocked")
    return controller.cancel();
  // Destroy only the renderer window after flushing. The native keeper owns the unlocked session.
  return session.phase === "unlocked"
    ? controller.prepareWindowClose()
    : Promise.resolve({ ok: true, value: undefined });
}

/** The outer boundary keeps the same guarded close path after a production render failure. */
export function DatabaseApplicationFallback() {
  const close = useRef<ReturnType<typeof createWindowCloseController> | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const owner = createWindowCloseController({
      client: tauriWindowCloseClient,
      prepareClose,
      onError: () => setFailed(true),
    });
    close.current = owner;
    return () => {
      close.current = null;
      owner.dispose();
    };
  }, []);
  return (
    <div className="taskmap-target-theme">
      <main role="alert">
        <h1>TaskMap could not open this part of the application.</h1>
        <p>Please close TaskMap and try again.</p>
        <button
          type="button"
          onClick={() => {
            setFailed(false);
            void close.current?.requestClose();
          }}
        >
          Close TaskMap
        </button>
        {failed && <p>The workspace could not be saved safely. Please retry closing.</p>}
      </main>
    </div>
  );
}

export function DatabaseApplication() {
  const [runtime, setRuntime] = useState<DatabaseApplicationRuntime | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let attached = true;
    void start().then(
      (result) => {
        if (!attached) return;
        if (result.ok) setRuntime(result.value);
        else setFailed(true);
      },
      () => {
        if (attached) setFailed(true);
      },
    );
    return () => {
      attached = false;
    };
  }, []);
  return (
    <div className="taskmap-target-theme" style={{ height: "100%" }}>
      {runtime ? (
        <ApplicationErrorBoundary reporter={defaultApplicationErrorReporter}>
          <DatabaseSessionGate runtime={runtime}>
            <RetainedCanvasApplication runtime={runtime} />
          </DatabaseSessionGate>
        </ApplicationErrorBoundary>
      ) : (
        <p role={failed ? "alert" : "status"}>
          {failed
            ? "TaskMap could not start the database session. Close and reopen the app."
            : "Starting TaskMap…"}
        </p>
      )}
      <DatabaseWindowChrome prepareClose={prepareClose} />
    </div>
  );
}

if (import.meta.hot)
  import.meta.hot.dispose(() => {
    void boot?.then((result) => (result.ok ? result.value.controller.dispose() : undefined));
    boot = undefined;
  });
