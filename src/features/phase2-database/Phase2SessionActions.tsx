import type { TaskMapDocument } from "../../domain/document/documentTypes";
import type { DatabaseClient } from "../../platform/database/databaseClient";
import { encodeDatabaseDocument } from "../../platform/database/databaseDocumentCodec";
import type { DatabaseSessionStatus, LoadedDocument } from "../../platform/database/databaseTypes";
import type { SettingsClient } from "../../platform/settings/settingsClient";
import { saveThenLockPhase2Document } from "./phase2LockOperation";

interface Phase2SessionActionsProps {
  readonly busy: boolean;
  readonly databaseClient: DatabaseClient;
  readonly settingsClient: SettingsClient;
  readonly session: DatabaseSessionStatus;
  readonly document: TaskMapDocument | null;
  readonly run: (operation: () => Promise<void>) => Promise<void>;
  readonly onFailure: (message: string) => void;
  readonly onLoaded: (loaded: LoadedDocument) => void;
  readonly onSessionReceived: (session: DatabaseSessionStatus) => void;
  readonly onDismiss: () => void;
}

export function Phase2SessionActions({
  busy,
  databaseClient,
  settingsClient,
  session,
  document,
  run,
  onFailure,
  onLoaded,
  onSessionReceived,
  onDismiss,
}: Phase2SessionActionsProps) {
  const unlocked = session.phase === "unlocked";
  return (
    <div className="phase2-harness-row">
      <button
        type="button"
        disabled={busy || !unlocked}
        onClick={() =>
          void run(async () => {
            const result = await databaseClient.readDocument();
            if (result.ok) return onLoaded(result.value);
            onFailure(result.error.message);
            const status = await databaseClient.getSessionStatus();
            if (status.ok) onSessionReceived(status.value);
          })
        }
      >
        Read
      </button>
      <button
        type="button"
        disabled={busy || !document || session.revision === null}
        onClick={() =>
          void run(async () => {
            const encoded = encodeDatabaseDocument(document!);
            if (!encoded.ok) return onFailure(encoded.error.message);
            const result = await databaseClient.saveDocument({
              serializedDocument: encoded.value,
              expectedRevision: session.revision!,
            });
            if (result.ok) onSessionReceived(result.value.session);
            else onFailure(result.error.message);
          })
        }
      >
        Save
      </button>
      <button
        type="button"
        disabled={busy || !unlocked}
        onClick={() =>
          void run(async () => {
            const result = await saveThenLockPhase2Document(
              databaseClient,
              document,
              session.revision,
            );
            if (!result.ok) return onFailure(result.error.message);
            onSessionReceived(result.value);
            onDismiss();
          })
        }
      >
        Lock
      </button>
      <button
        type="button"
        disabled={busy || session.phase === "closed" || session.phase === "pending_unlock"}
        onClick={() =>
          void run(async () => {
            const destination = await settingsClient.chooseDatabasePath("full_backup");
            if (!destination.ok) return onFailure(destination.error.message);
            if (!destination.value) return;
            const result = await databaseClient.fullBackup(destination.value.authorizationToken);
            if (!result.ok) onFailure(result.error.message);
          })
        }
      >
        Full backup
      </button>
      <button
        type="button"
        disabled={busy || session.phase === "closed"}
        onClick={() =>
          void run(async () => {
            if (
              document &&
              !globalThis.confirm("Discard unsaved Phase 2 harness edits and close the session?")
            ) {
              return;
            }
            const result = await databaseClient.closeDatabase();
            if (!result.ok) return onFailure(result.error.message);
            onSessionReceived(result.value);
            onDismiss();
          })
        }
      >
        Close session
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() =>
          void run(async () => {
            if (session.phase === "unlocked") {
              const locked = await saveThenLockPhase2Document(
                databaseClient,
                document,
                session.revision,
              );
              if (!locked.ok) return onFailure(locked.error.message);
            }
            const result = await databaseClient.quitApplication();
            if (!result.ok) onFailure(result.error.message);
          })
        }
      >
        Quit TaskMap
      </button>
    </div>
  );
}
