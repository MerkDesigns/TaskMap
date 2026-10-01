import { useEffect, useRef, useState } from "react";
import { IconLock, IconLogout } from "@tabler/icons-react";
import { Button } from "../ui/primitives";
import { SettingsIsland } from "../ui/patterns/settings";

export interface DatabaseSettingsActionsProps {
  lock(): Promise<boolean>;
  close(): Promise<boolean>;
}

/** Session actions save through the lifecycle owner before leaving the canvas. */
export function DatabaseSettingsActions(actions: DatabaseSettingsActionsProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const run = async (action: () => Promise<boolean>) => {
    setBusy(true);
    setError(false);
    let ok = false;
    try {
      ok = await action();
    } catch {
      /* Show a content-free failure. */
    }
    if (mounted.current) {
      setError(!ok);
      setBusy(false);
    }
  };
  return (
    <div className="taskmap-settings-content-stack">
      <SettingsIsland className="taskmap-settings-data-action">
        <div className="taskmap-settings-data-grid">
          <Button
            leadingIcon={<IconLock size={18} stroke={2} />}
            disabled={busy}
            onClick={() => void run(actions.lock)}
          >
            Lock database
          </Button>
          <Button
            leadingIcon={<IconLogout size={18} stroke={2} />}
            disabled={busy}
            onClick={() => void run(actions.close)}
          >
            Close database
          </Button>
        </div>
      </SettingsIsland>
      {error && (
        <p role="alert" className="taskmap-settings-data-status">
          The database action could not be completed. Please retry.
        </p>
      )}
    </div>
  );
}
